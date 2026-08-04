import { EntityManager } from "@mikro-orm/mongodb";
import { FastifyRequest } from "fastify";
import { InputType, Field, ObjectType } from "type-graphql";

/* Entities */
import { FieldError } from "./entities/Errors/FieldError";
import { User } from "./entities/User";
import { Bookmark } from "./entities/Bookmark";
import { GraphQLScalarType, Kind } from "graphql";

/** Minimal request shape shared by HTTP (Fastify) and GraphQL WS contexts. */
export type AuthRequest = {
  userId?: string;
  cookies?: Record<string, string | undefined>;
  headers?: Record<string, string | string[] | undefined>;
};

/** Cookie helpers used by HTTP auth middleware and no-op WS shims. */
export type CookieReply = {
  cookie: (...args: any[]) => any;
  clearCookie: (...args: any[]) => any;
};

export type MyContext = {
  request: FastifyRequest | AuthRequest;
  reply: CookieReply;
  em: EntityManager;
  /** Authenticated user id (set for WS; HTTP uses request.userId via middleware). */
  userId?: string;
  /** Device channel claimed via WS connectionParams (anonymous chat). */
  deviceId?: string;
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
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];

  @Field(() => Bookmark || [Bookmark], { nullable: true })
  results?: Bookmark | Bookmark[];
}

@ObjectType()
export class GetBookmarkResponse {
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];

  @Field(() => [Bookmark], { nullable: true })
  results?: Bookmark[];
}

export const JSONScalar = new GraphQLScalarType({
  name: "JSON",
  description: "Custom scalar type for representing JSON data",
  parseValue(value: any) {
    return JSON.parse(value);
  },
  serialize(value: any) {
    return value;
  },
  parseLiteral(ast) {
    switch (ast.kind) {
      case Kind.STRING:
        return JSON.parse(ast.value);
      case Kind.OBJECT:
        throw new Error("Invalid JSON object");
      default:
        return null;
    }
  },
});
