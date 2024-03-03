import { JSONScalar } from "../../types";
import { Field, ObjectType } from "type-graphql";

@ObjectType()
export class BBLanguage {
  @Field()
  id: number;

  @Field(() => String)
  glotto_id: string;

  @Field(() => String)
  iso: string;

  @Field(() => String)
  name: string;

  @Field(() => String)
  autonym: string;

  @Field()
  bibles: number;

  @Field()
  filesets: number;

  @Field({ nullable: true })
  rolv_code: string;

  @Field()
  country_population: number;

  @Field(() => JSONScalar)
  translations: Record<string, string>;
}
