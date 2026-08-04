import { MongoDriver, MongoEntityManager } from "@mikro-orm/mongodb";
import { BaseMessage } from "@langchain/core/messages";
import { BaseListChatMessageHistory } from "@langchain/core/chat_history";
import { AIMessage } from "../entities/AIMemory";
import {
  mapChatMessagesToStoredMessages,
  mapStoredMessagesToChatMessages,
} from "./utils";
import { User } from "../entities/User";

export interface MikroORMChatMessageHistoryInput {
  em: MongoEntityManager<MongoDriver>;
  chatId: string;
  limit: number;
  owner?: User;
  /** When true, refuse to read/write history owned by a different user. */
  requireOwnerMatch?: boolean;
}

/**
 * Per-chat Mongo message history backed by the AIMessage entity.
 */
export class MikroORMChatMessageHistory extends BaseListChatMessageHistory {
  lc_namespace = ["langchain", "stores", "message", "mikroorm"];

  private em: MongoEntityManager<MongoDriver>;
  private chatId: string;
  public limit: number;
  public owner?: User;
  private requireOwnerMatch: boolean;

  constructor({
    em,
    chatId,
    limit,
    owner,
    requireOwnerMatch = false,
  }: MikroORMChatMessageHistoryInput) {
    super();
    this.em = em;
    this.chatId = chatId;
    this.limit = limit;
    this.owner = owner;
    this.requireOwnerMatch = requireOwnerMatch;
  }

  private assertOwnerAccess(docOwnerId?: string | null): void {
    if (!this.requireOwnerMatch || !this.owner) return;
    if (docOwnerId && docOwnerId !== this.owner._id.toString()) {
      throw new Error("Chat history access denied for this user");
    }
  }

  /**
   * Load only the trailing window of messages via Mongo $slice projection.
   */
  async getMessages(): Promise<BaseMessage[]> {
    const collection = this.em.getCollection(AIMessage);
    const raw = await collection.findOne(
      { chatId: this.chatId },
      {
        projection: {
          messages: { $slice: -this.limit },
          owner: 1,
          chatId: 1,
        },
      }
    );

    if (!raw) {
      return [];
    }

    const ownerId = raw.owner != null ? String(raw.owner) : null;
    this.assertOwnerAccess(ownerId);

    const messages = (raw.messages as AIMessage["messages"]) || [];
    return mapStoredMessagesToChatMessages(messages);
  }

  async addMessage(message: BaseMessage): Promise<void> {
    const readyToStoreMessage = mapChatMessagesToStoredMessages([message]);
    const now = new Date();

    try {
      await this.em.transactional(async (em) => {
        const aiMessage = await em.findOne(AIMessage, {
          chatId: this.chatId,
        });

        if (!aiMessage) {
          const newMessage = em.create(AIMessage, {
            chatId: this.chatId,
            messages: readyToStoreMessage,
            owner: this.owner,
            createdAt: now,
            updatedAt: now,
          });
          await em.persistAndFlush(newMessage);
          return;
        }

        const existingOwnerId = aiMessage.owner?._id?.toString();
        this.assertOwnerAccess(existingOwnerId);

        aiMessage.messages = [
          ...aiMessage.messages,
          ...readyToStoreMessage,
        ].slice(-this.limit);
        aiMessage.updatedAt = now;

        if (this.owner && !aiMessage.owner) {
          aiMessage.owner = this.owner;
        }

        await em.persistAndFlush(aiMessage);
      });
    } catch (error) {
      console.error("Error adding message:", error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      if (this.requireOwnerMatch && this.owner) {
        const existing = await this.em.findOne(AIMessage, {
          chatId: this.chatId,
        });
        this.assertOwnerAccess(existing?.owner?._id?.toString());
      }

      await this.em.getCollection(AIMessage).deleteOne({
        chatId: this.chatId,
      });
    } catch (error) {
      console.error("Error clearing messages:", error);
      throw error;
    }
  }
}
