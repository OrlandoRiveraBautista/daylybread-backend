import { JSONScalar } from "../../types";
import { Field, ObjectType } from "type-graphql";

@ObjectType()
export class BBBook {
  @Field({ nullable: true })
  bookId?: string;

  @Field({ nullable: true })
  bookIdUsfx?: string;

  @Field({ nullable: true })
  bookIdOsis?: string;

  @Field({ nullable: true })
  name?: string;

  @Field(() => String, { nullable: true })
  testament?: string;

  @Field({ nullable: true })
  testamentOrder?: number;

  @Field({ nullable: true })
  bookOrder?: string;

  @Field({ nullable: true })
  bookGroup?: string;

  @Field({ nullable: true })
  nameShort?: string;

  @Field(() => [Number], { nullable: true })
  chapters?: Array<number>;

  @Field(() => JSONScalar, { nullable: true })
  contentTypes?: Record<string, string>;
}
