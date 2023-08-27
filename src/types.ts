// import { IDatabaseDriver, Connection } from "@mikro-orm/core";
import { EntityManager } from "@mikro-orm/mongodb";
import { OpenAI } from "langchain/llms/openai";
import { ConversationChain } from "langchain/chains";
import { FastifyReply, FastifyRequest } from "fastify";

export type MyContext = {
  request: FastifyRequest;
  reply: FastifyReply;
  em: EntityManager;
  openai: OpenAI;
  chatgpt: ConversationChain;
};
