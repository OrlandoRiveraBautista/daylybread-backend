// import { IDatabaseDriver, Connection } from "@mikro-orm/core";
import { EntityManager } from "@mikro-orm/mongodb";
import { OpenAI } from "langchain/llms/openai";
import { ConversationChain } from "langchain/chains";

export type MyContext = {
  em: EntityManager;
  openai: OpenAI;
  chatgpt: ConversationChain;
};
