import { MongoDriver, MongoEntityManager } from "@mikro-orm/mongodb";
import { BaseMessage, StoredMessage } from "@langchain/core/messages";
import { BaseListChatMessageHistory } from "@langchain/core/chat_history";
import { AIMessage } from "../entities/AIMemory";
import {
  mapChatMessagesToStoredMessages,
  mapStoredMessagesToChatMessages,
} from "./utils";
import { Loaded } from "@mikro-orm/core";

export interface MikroORMChatMessageHistoryInput {
  em: MongoEntityManager<MongoDriver>;
  chatId: string;
  limit: Number;
}

/**
 * @example
 * ```typescript
 * const chatHistory = new MikroORMChatMessageHistory({
 *   em: em,
 *   chatId: 'unique-chat-id',
 *   limit: 5
 * });
 * const messages = await chatHistory.getMessages();
 * await chatHistory.clear();
 * ```
 */
export class MikroORMChatMessageHistory extends BaseListChatMessageHistory {
  lc_namespace = ["langchain", "stores", "message", "mikroorm"];

  private em: MongoEntityManager<MongoDriver>;
  private chatId: string;
  private document: Loaded<AIMessage, never> | null;
  public limit: Number;

  constructor({ em, chatId, limit }: MikroORMChatMessageHistoryInput) {
    super();
    this.em = em;
    this.chatId = chatId;
    this.limit = limit;
  }

  async getMessages(): Promise<BaseMessage[]> {
    this.document = await this.em.findOne(AIMessage, {
      chatId: this.chatId,
    });

    const messages = this.document?.messages.slice(-this.limit) || [];

    return mapStoredMessagesToChatMessages(messages);
  }

  async addMessage(message: BaseMessage): Promise<void> {
    let readyToStoreMessage: StoredMessage[] = mapChatMessagesToStoredMessages([
      message,
    ]);

    if (this.document) {
      readyToStoreMessage = this.document?.messages
        .slice(-this.limit)
        .concat(readyToStoreMessage);
    }

    try {
      this.document = await this.em.upsert(AIMessage, {
        chatId: this.chatId,
        messages: readyToStoreMessage,
      });
    } catch (error) {
      console.log(error);
    }
  }

  async clear(): Promise<void> {
    const messagesFromDb = this.em.findOne(AIMessage, {
      chatId: this.chatId,
    });
    this.em.remove(messagesFromDb);
    await this.em.flush();
  }
}
