import {
  AiInputTooLargeError,
  AiRateLimitError,
} from "./rateLimit";

/**
 * Map thrown AI errors to a safe client-facing message (no stack / raw SDK dumps).
 */
export function toSafeAiErrorMessage(error: unknown): string {
  if (error instanceof AiRateLimitError || error instanceof AiInputTooLargeError) {
    return error.message;
  }

  if (error instanceof Error) {
    const msg = error.message || "";
    if (/api key|authentication|unauthorized/i.test(msg)) {
      return "AI service is not configured correctly. Please try again later.";
    }
    if (/rate limit|429/i.test(msg)) {
      return "The AI service is busy. Please try again in a moment.";
    }
    if (/timeout|ETIMEDOUT|ECONNABORTED/i.test(msg)) {
      return "The AI request timed out. Please try again.";
    }
  }

  return "An unexpected AI error occurred. Please try again.";
}
