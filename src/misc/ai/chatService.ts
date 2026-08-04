import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { MongoDriver, MongoEntityManager } from "@mikro-orm/mongodb";
import { User } from "../../entities/User";
import { MikroORMChatMessageHistory } from "../mikroormMessageHistory";
import { AI_CONFIG } from "./config";
import { createChatModel } from "./createChatModel";
import { timedAiCall } from "./observability";
import {
  assertInputWithinLimit,
  assertWithinDailyLimit,
  recordAiUsage,
  withAiSlot,
} from "./rateLimit";

const CHAT_SYSTEM_PROMPT = `You are BreadCrumbs, an AI chat assistant that answers all questions **strictly based on the Bible**. Users can ask general biblical questions or provide a specific verse for contextual discussion. You should always reference scripture in your responses, using the provided Bible version or defaulting to RVR (Spanish) and KJV (English).

If a question is not answered in the Bible, you must **clearly state that the Bible does not provide an answer** instead of speculating. Keep your tone **friendly, thoughtful, and engaging**, ensuring that all responses align with biblical teachings.

If a user asks something unrelated to the Bible, politely **redirect them back to biblical topics** rather than engaging with off-topic discussions.`;

/** Chat threads remain device-scoped so anonymous users keep continuity. */
export function buildChatId(deviceId: string): string {
  return deviceId.trim();
}

export type RunBibleChatOptions = {
  em: MongoEntityManager<MongoDriver>;
  user?: User;
  deviceId: string;
  promptText: string;
  onToken?: (token: string) => Promise<void> | void;
};

/**
 * Per-request Bible chat — no shared ConversationChain / mutable memory.
 * Works for anonymous (deviceId) and authenticated users.
 */
export async function runBibleChat(
  options: RunBibleChatOptions
): Promise<string> {
  if (!options.deviceId?.trim()) {
    throw new Error("deviceId is required");
  }

  const deviceId = options.deviceId.trim();
  const isAnonymous = !options.user;
  const rateLimitKey = `device:${deviceId}`;

  assertInputWithinLimit(options.promptText);
  // Daily quotas only apply to anonymous chat; logged-in users are uncapped here.
  if (isAnonymous) {
    assertWithinDailyLimit(rateLimitKey, "chat");
  }

  return withAiSlot(() =>
    timedAiCall(
      {
        feature: "chat",
        userId: options.user?._id.toString(),
        model: AI_CONFIG.model,
        streaming: true,
        meta: { anonymous: isAnonymous },
      },
      async () => {
        const history = new MikroORMChatMessageHistory({
          em: options.em,
          chatId: buildChatId(deviceId),
          limit: AI_CONFIG.chatHistoryLimit,
          owner: options.user,
          // Device-scoped anonymous chat: don't require owner match.
          requireOwnerMatch: false,
        });

        const prior = await history.getMessages();
        const messages = [
          new SystemMessage(CHAT_SYSTEM_PROMPT),
          ...prior,
          new HumanMessage(options.promptText),
        ];

        const model = createChatModel({
          temperature: AI_CONFIG.temperatures.chat,
          streaming: true,
          maxTokens: AI_CONFIG.maxTokens.chat,
        });

        let full = "";
        const stream = await model.stream(messages);
        for await (const chunk of stream) {
          const token =
            typeof chunk.content === "string"
              ? chunk.content
              : Array.isArray(chunk.content)
                ? chunk.content
                    .map((part) =>
                      typeof part === "string"
                        ? part
                        : "text" in part
                          ? String((part as { text?: string }).text || "")
                          : ""
                    )
                    .join("")
                : String(chunk.content ?? "");

          if (!token) continue;
          full += token;
          if (options.onToken) {
            await options.onToken(token);
          }
        }

        await history.addMessage(new HumanMessage(options.promptText));
        await history.addMessage(new AIMessage(full));
        if (isAnonymous) {
          recordAiUsage(rateLimitKey, "chat");
        }
        return full;
      }
    )
  );
}
