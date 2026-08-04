import { ChatOpenAI } from "@langchain/openai";
import { AI_CONFIG } from "./config";

export type CreateChatModelOptions = {
  temperature?: number;
  streaming?: boolean;
  maxTokens?: number;
};

/**
 * Shared ChatOpenAI factory — one place for model name, key, retries, and timeout.
 */
export function createChatModel(options: CreateChatModelOptions = {}): ChatOpenAI {
  if (!AI_CONFIG.apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  return new ChatOpenAI({
    modelName: AI_CONFIG.model,
    openAIApiKey: AI_CONFIG.apiKey,
    temperature: options.temperature ?? AI_CONFIG.temperatures.chat,
    streaming: options.streaming ?? false,
    maxTokens: options.maxTokens,
    maxRetries: AI_CONFIG.maxRetries,
    timeout: AI_CONFIG.timeoutMs,
  });
}
