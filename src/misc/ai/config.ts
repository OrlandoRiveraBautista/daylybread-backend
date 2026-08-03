/**
 * Centralized AI / LangChain configuration (env-overridable).
 */
export const AI_CONFIG = {
  model: process.env.OPENAI_MODEL || "gpt-4o-mini",
  apiKey: process.env.OPENAI_API_KEY || "",
  maxRetries: Number(process.env.AI_MAX_RETRIES) || 2,
  timeoutMs: Number(process.env.AI_TIMEOUT_MS) || 60_000,
  maxConcurrent: Number(process.env.AI_MAX_CONCURRENT) || 5,
  maxInputChars: Number(process.env.AI_MAX_INPUT_CHARS) || 4_000,
  sermonContentMaxChars: Number(process.env.AI_SERMON_CONTENT_MAX_CHARS) || 2_000,
  chatHistoryLimit: Number(process.env.AI_CHAT_HISTORY_LIMIT) || 5,
  chatDailyLimit: Number(process.env.AI_CHAT_DAILY_LIMIT) || 50,
  sermonDailyLimit: Number(process.env.AI_SERMON_DAILY_LIMIT) || 100,
  moodDailyLimit: Number(process.env.AI_MOOD_DAILY_LIMIT) || 48,
  maxTokens: {
    chat: Number(process.env.AI_CHAT_MAX_TOKENS) || 1_024,
    mood: Number(process.env.AI_MOOD_MAX_TOKENS) || 512,
    sermon: Number(process.env.AI_SERMON_MAX_TOKENS) || 2_048,
  },
  temperatures: {
    chat: 0,
    mood: 0.9,
    sermon: 0.7,
  },
} as const;

export type AiFeature = "chat" | "mood" | "sermon";
