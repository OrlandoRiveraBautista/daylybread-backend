import { createMethodDecorator } from "type-graphql";
import { MyContext } from "../types";
import { BufferWindowMemory } from "langchain/memory";
import { MikroORMChatMessageHistory } from "../misc/mikroormMessageHistory";
import { generateObjectIdFromString } from "../utility";

/**
 * Middleware function to setup the chatgpt prompt and memory
 */
export const SetupChatGpt = () => {
  return createMethodDecorator(
    async ({ context }: { context: MyContext }, next) => {
      console.log("At the start of the setup");
      // variables needed for function
      const request = context.request as any; // set request as any use freely
      const chain = context.chatgpt;
      const memory = chain.memory as BufferWindowMemory;
      // generate a new ObjectId based on the IP address
      const chatId = generateObjectIdFromString(
        request.connection.remoteAddress
      );
      console.log("request ip", request.raw.connection.remoteAddress);
      console.log("chatid: ", chatId);

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
