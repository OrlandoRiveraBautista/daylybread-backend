import { JSONScalar } from "../../types";
import { Field, ObjectType } from "type-graphql";

@ObjectType()
export class BBBible {
  @Field({ nullable: true })
  abbr?: string;

  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => String, { nullable: true })
  vname?: string;

  @Field(() => String, { nullable: true })
  language?: string;

  @Field(() => String, { nullable: true })
  autonym?: string;

  @Field({ nullable: true })
  languageId?: number;

  @Field({ nullable: true })
  iso?: string;

  @Field({ nullable: true })
  date?: string;

  @Field(() => JSONScalar, { nullable: true })
  filesets?: Record<string, string>;
}
