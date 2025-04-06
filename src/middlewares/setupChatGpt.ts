import { MyContext } from "../types";
import { BufferWindowMemory } from "langchain/memory";
import { MikroORMChatMessageHistory } from "../misc/mikroormMessageHistory";
import { User } from "../entities/User";
/**
 * Middleware function to setup the chatgpt prompt and memory
 */
// export const SetupChatGpt = () => {
//   return createMethodDecorator(
//     async ({ context }: { context: MyContext }, next) => {
//       // variables needed for function
//       const chain = context.chatgpt;
//       const memory = chain.memory as BufferWindowMemory;
//       // generate a new ObjectId based on the IP address
//       const chatId = generateObjectIdFromString(ip.address());

//       //   create a new message history and set it to chatHistory to be consumed by the model
//       memory.chatHistory = new MikroORMChatMessageHistory({
//         em: context.em,
//         chatId: chatId,
//         limit: memory.k,
//       });

//       return next();
//     }
//   );
// };

export const setupChatGpt = async (
  context: MyContext,
  deviceId: string,
  user: User | undefined
) => {
  // variables needed for function
  const chain = context.chatgpt;
  const memory = chain.memory as BufferWindowMemory;
  // generate a new ObjectId based on the IP address
  // const chatId = generateObjectIdFromString(ip.address());

  //   create a new message history and set it to chatHistory to be consumed by the model
  memory.chatHistory = new MikroORMChatMessageHistory({
    em: context.em,
    chatId: deviceId,
    limit: memory.k,
    owner: user,
  });
};
