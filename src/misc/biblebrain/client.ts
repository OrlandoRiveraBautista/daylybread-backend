import axios, { AxiosError, AxiosInstance } from "axios";
import dotenv from "dotenv";

dotenv.config();

/** DBP host — override with BIBLE_BRAIN_BASE_URL if needed (no trailing slash). */
const BASE_URL =
  process.env.BIBLE_BRAIN_BASE_URL?.replace(/\/$/, "") || "https://4.dbt.io";

const REQUEST_TIMEOUT_MS = Number(process.env.BIBLE_BRAIN_TIMEOUT_MS) || 15_000;
const MAX_RETRIES = Number(process.env.BIBLE_BRAIN_MAX_RETRIES) || 3;
/** Cap in-flight Brain calls so list fan-out / chapter prefetch can't stampede the API. */
const MAX_CONCURRENT = Number(process.env.BIBLE_BRAIN_MAX_CONCURRENT) || 10;

// Simple process-local semaphore: waiters resolve FIFO when a slot frees up.
let activeRequests = 0;
const waitQueue: Array<() => void> = [];

async function acquireSlot(): Promise<void> {
  if (activeRequests < MAX_CONCURRENT) {
    activeRequests++;
    return;
  }
  await new Promise<void>((resolve) => waitQueue.push(resolve));
  activeRequests++;
}

function releaseSlot(): void {
  activeRequests--;
  const next = waitQueue.shift();
  if (next) next();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retry network blips and rate-limit / gateway errors — not 4xx client mistakes. */
function isRetryable(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  const axiosError = error as AxiosError;
  if (!axiosError.response) return true; // network / timeout
  const status = axiosError.response.status;
  return status === 429 || status === 502 || status === 503 || status === 504;
}

/**
 * Shared Axios client for Bible Brain / DBP v4.
 * Instance defaults stay immutable — each call passes its own path + params
 * so concurrent GraphQL requests never race on a shared `config.url`.
 *
 * Auth: DBP expects the API key in the `key` header (set via BIBLE_BRAIN_API_KEY).
 */
export const bibleBrainClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: {
    key: process.env.BIBLE_BRAIN_API_KEY || "",
    v: "4",
  },
  maxBodyLength: Infinity,
});

/**
 * GET helper with concurrency limiting, empty-param stripping, and exponential
 * backoff (+ jitter) on retryable failures.
 */
export async function bibleBrainGet<T = unknown>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>
): Promise<T> {
  // Drop undefined/empty so we don't send `?country=` noise to DBP.
  const cleanParams: Record<string, string | number | boolean> = {};
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") {
        cleanParams[key] = value;
      }
    }
  }

  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    await acquireSlot();
    try {
      const { data } = await bibleBrainClient.get<T>(path, {
        // `v` is also on the client headers; query param keeps older DBP routes happy.
        params: { v: 4, ...cleanParams },
      });
      return data;
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) || attempt === MAX_RETRIES) {
        throw error;
      }
      // 200ms, 400ms, 800ms… plus small jitter to desync parallel retries.
      const backoff =
        200 * Math.pow(2, attempt) + Math.floor(Math.random() * 100);
      await sleep(backoff);
    } finally {
      releaseSlot();
    }
  }

  throw lastError;
}
