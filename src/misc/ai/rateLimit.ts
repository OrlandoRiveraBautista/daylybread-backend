import { AI_CONFIG, AiFeature } from "./config";

type DayBucket = {
  dayKey: string;
  counts: Map<string, number>;
};

const dailyBuckets: Partial<Record<AiFeature, DayBucket>> = {
  chat: { dayKey: "", counts: new Map() },
};

const FEATURE_LIMITS: Partial<Record<AiFeature, number>> = {
  chat: AI_CONFIG.chatDailyLimit,
};

let activeAiRequests = 0;
const waitQueue: Array<() => void> = [];

function utcDayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function ensureDayBucket(feature: AiFeature): DayBucket {
  const key = utcDayKey();
  let bucket = dailyBuckets[feature];
  if (!bucket) {
    bucket = { dayKey: key, counts: new Map() };
    dailyBuckets[feature] = bucket;
    return bucket;
  }
  if (bucket.dayKey !== key) {
    bucket.dayKey = key;
    bucket.counts.clear();
  }
  return bucket;
}

export class AiRateLimitError extends Error {
  constructor(
    public readonly feature: AiFeature,
    public readonly limit: number
  ) {
    super(`Daily AI limit reached for ${feature} (${limit}/day). Try again tomorrow.`);
    this.name = "AiRateLimitError";
  }
}

export class AiInputTooLargeError extends Error {
  constructor(public readonly maxChars: number) {
    super(`Input exceeds the maximum allowed length (${maxChars} characters).`);
    this.name = "AiInputTooLargeError";
  }
}

/**
 * Enforce daily quotas for anonymous callers (keyed by device id, etc.).
 * Process-local only — use Redis for multi-instance.
 */
export function assertWithinDailyLimit(key: string, feature: AiFeature): void {
  const limit = FEATURE_LIMITS[feature];
  if (limit == null) return;

  const bucket = ensureDayBucket(feature);
  const used = bucket.counts.get(key) || 0;
  if (used >= limit) {
    throw new AiRateLimitError(feature, limit);
  }
}

export function recordAiUsage(key: string, feature: AiFeature): void {
  if (FEATURE_LIMITS[feature] == null) return;
  const bucket = ensureDayBucket(feature);
  bucket.counts.set(key, (bucket.counts.get(key) || 0) + 1);
}

export function assertInputWithinLimit(
  ...parts: Array<string | undefined | null>
): void {
  const total = parts.reduce((sum, part) => sum + (part?.length || 0), 0);
  if (total > AI_CONFIG.maxInputChars) {
    throw new AiInputTooLargeError(AI_CONFIG.maxInputChars);
  }
}

/** Global concurrency cap for OpenAI calls. */
export async function acquireAiSlot(): Promise<void> {
  if (activeAiRequests < AI_CONFIG.maxConcurrent) {
    activeAiRequests++;
    return;
  }
  await new Promise<void>((resolve) => waitQueue.push(resolve));
  activeAiRequests++;
}

export function releaseAiSlot(): void {
  activeAiRequests--;
  const next = waitQueue.shift();
  if (next) next();
}

export async function withAiSlot<T>(fn: () => Promise<T>): Promise<T> {
  await acquireAiSlot();
  try {
    return await fn();
  } finally {
    releaseAiSlot();
  }
}
