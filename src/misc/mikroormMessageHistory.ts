import { MongoDriver, MongoEntityManager } from "@mikro-orm/mongodb";
import { BaseMessage } from "@langchain/core/messages";
import { BaseListChatMessageHistory } from "@langchain/core/chat_history";
import { AIMessage } from "../entities/AIMemory";
import {
  mapChatMessagesToStoredMessages,
  mapStoredMessagesToChatMessages,
} from "./utils";
import { Loaded } from "@mikro-orm/core";
import { User } from "../entities/User";

export interface MikroORMChatMessageHistoryInput {
  em: MongoEntityManager<MongoDriver>;
  chatId: string;
  limit: Number;
  owner?: User;
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
  public owner?: User;

  constructor({ em, chatId, limit, owner }: MikroORMChatMessageHistoryInput) {
    super();
    this.em = em;
    this.chatId = chatId;
    this.limit = limit;
    this.owner = owner;
  }

  /**
   * Get the messages from the database
   * @returns An array of BaseMessage objects
   */
  async getMessages(): Promise<BaseMessage[]> {
    // Get the document from the database
    this.document = await this.em.findOne(AIMessage, {
      chatId: this.chatId,
    });

    // Get the messages from the document
    const messages = this.document?.messages.slice(-this.limit) || [];

    // Map the messages to BaseMessage objects
    return mapStoredMessagesToChatMessages(messages);
  }

  /**
   * Add a message to the database
   * @param message - The message to add
   */
  async addMessage(message: BaseMessage): Promise<void> {
    const readyToStoreMessage = mapChatMessagesToStoredMessages([message]);
    const now = new Date();

    try {
      // Use $push with $slice to atomically add the message and maintain the limit
      // Also update timestamps atomically
      await this.em.getCollection(AIMessage).updateOne(
        { chatId: this.chatId },
        {
          $push: {
            messages: {
              $each: readyToStoreMessage,
              $slice: -Number(this.limit), // Keep only the last 'limit' messages
            },
          },
          $set: {
            updatedAt: now,
          },
          $setOnInsert: {
            createdAt: now,
            owner: this.owner,
          },
        },
        { upsert: true }
      );

      // Update our local document reference
      this.document = await this.em.findOne(AIMessage, {
        chatId: this.chatId,
      });
    } catch (error) {
      console.error("Error adding message:", error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      await this.em.getCollection(AIMessage).deleteOne({
        chatId: this.chatId,
      });
      this.document = null;
    } catch (error) {
      console.error("Error clearing messages:", error);
      throw error;
    }
  }
}
