import { JSONScalar } from "../../types";
import { Field, ObjectType } from "type-graphql";

@ObjectType()
export class BBBible {
  @Field()
  abbr: string;

  @Field(() => String)
  name: string;

  @Field(() => String, { nullable: true })
  vname?: string;

  @Field(() => String)
  language: string;

  @Field(() => String)
  autonym: string;

  @Field()
  languageId: number;

  @Field()
  iso: string;

  @Field()
  date: string;

  @Field(() => JSONScalar)
  filesets: Record<string, string>;
}
