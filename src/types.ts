import { EntityManager } from "@mikro-orm/mongodb";
import { OpenAI } from "langchain/llms/openai";
import { ConversationChain } from "langchain/chains";
import { FastifyReply, FastifyRequest } from "fastify";
import { InputType, Field, ObjectType } from "type-graphql";

/* Entities */
import { FieldError } from "./entities/Errors/FieldError";
import { User } from "./entities/User";

export type MyContext = {
  request: FastifyRequest;
  reply: FastifyReply;
  em: EntityManager;
  openai: OpenAI;
  chatgpt: ConversationChain;
};

/* --- Arguments (Args) Object Input Types --- */
@InputType()
export class UsernamePasswordInput {
  @Field()
  email: string;

  @Field()
  password: string;
}

/* --- Response Object Types --- */
@ObjectType()
export class UserResponse {
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];

  @Field(() => User, { nullable: true })
  user?: User;
}
