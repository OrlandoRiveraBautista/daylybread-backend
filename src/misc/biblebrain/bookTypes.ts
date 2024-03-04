import { JSONScalar } from "../../types";
import { Field, ObjectType } from "type-graphql";

@ObjectType()
export class BBBook {
  @Field()
  bookId: string;

  @Field()
  bookIdUsfx: string;

  @Field()
  bookIdOsis: string;

  @Field()
  name: string;

  @Field(() => String)
  testament: string;

  @Field()
  testamentOrder: number;

  @Field()
  bookOrder: string;

  @Field()
  bookGroup: string;

  @Field()
  nameShort: string;

  @Field(() => [Number])
  chapters: Array<number>;

  @Field(() => JSONScalar)
  contentTypes: Record<string, string>;
}
