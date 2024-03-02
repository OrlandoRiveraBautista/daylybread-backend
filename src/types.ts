import { EntityManager } from "@mikro-orm/mongodb";
import { OpenAI } from "langchain/llms/openai";
import { ConversationChain } from "langchain/chains";
import { FastifyReply, FastifyRequest } from "fastify";
import { InputType, Field, ObjectType } from "type-graphql";
import * as AWS from "aws-sdk";

/* Entities */
import { FieldError } from "./entities/Errors/FieldError";
import { User } from "./entities/User";
import { Bookmark } from "./entities/Bookmark";

export type MyContext = {
  request: FastifyRequest;
  reply: FastifyReply;
  em: EntityManager;
  openai: OpenAI;
  chatgpt: ConversationChain;
  AWS: typeof AWS;
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

@ObjectType()
export class BookmarkResponse {
  /**
   * !Maybe we can build a reusable object type for responses
   */
  // private objectType: any
  // constructor(objectType: any) {
  //   this.objectType = objectType
  // }
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];

  @Field(() => Bookmark || [Bookmark], { nullable: true })
  results?: Bookmark | Bookmark[];
}

@ObjectType()
export class GetBookmarkResponse {
  /**
   * !Maybe we can build a reusable object type for responses
   */
  // private objectType: any
  // constructor(objectType: any) {
  //   this.objectType = objectType
  // }
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];

  @Field(() => [Bookmark], { nullable: true })
  results?: Bookmark[];
}
