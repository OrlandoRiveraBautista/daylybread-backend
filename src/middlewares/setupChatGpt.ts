import { createMethodDecorator } from "type-graphql";
import { MyContext } from "../types";
import { BufferWindowMemory } from "langchain/memory";
import { MikroORMChatMessageHistory } from "../misc/mikroormMessageHistory";
import crypto from "crypto";

/**
 * Middleware function to setup the chatgpt prompt and memory
 */
export const SetupChatGpt = () => {
  return createMethodDecorator(
    async ({ context }: { context: MyContext }, next) => {
      // variables needed for function
      const request = context.request as any; // set request as any use freely
      const chain = context.chatgpt;
      const memory = chain.memory as BufferWindowMemory;
      // generate a new ObjectId based on the IP address
      const chatId = generateObjectIdFromString(request.ip);

      //   create a new message history and set it to chatHistory to be consumed by the model
      memory.chatHistory = new MikroORMChatMessageHistory({
        em: context.em,
        chatId: chatId,
        limit: memory.k,
      });

      return next();
    }
  );
};

/**
 * Function generates an ObjectId from a string
 */
const generateObjectIdFromString = (string: string) => {
  // Use a hash function to create a deterministic hash from the IP address
  const hash = crypto.createHash("md5").update(string).digest("hex");

  // Extract a portion of the hash to use as the object ID
  const objectId = hash; // Adjust the length as needed

  return objectId;
};
