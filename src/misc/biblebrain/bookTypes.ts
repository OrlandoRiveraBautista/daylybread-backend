import { JSONScalar } from "../../types";
import { Field, ObjectType } from "type-graphql";

@ObjectType()
export class BBBook {
  @Field()
  book_id: string;

  @Field()
  book_id_usfx: string;

  @Field()
  book_id_osis: string;

  @Field()
  name: string;

  @Field(() => String)
  testament: string;

  @Field()
  testament_order: number;

  @Field()
  book_order: string;

  @Field()
  book_group: string;

  @Field()
  name_short: string;

  @Field(() => [Number])
  chapters: Array<number>;

  @Field(() => JSONScalar)
  content_types: Record<string, string>;
}
