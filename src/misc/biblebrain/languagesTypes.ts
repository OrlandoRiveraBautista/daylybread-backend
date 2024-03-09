import { JSONScalar } from "../../types";
import { Field, ObjectType } from "type-graphql";

@ObjectType()
export class BBLanguage {
  @Field()
  id: number;

  @Field(() => String, { nullable: true })
  glottoId?: string;

  @Field(() => String, { nullable: true })
  iso?: string;

  @Field(() => String, { nullable: true })
  name?: string;

  @Field(() => String, { nullable: true })
  autonym?: string;

  @Field()
  bibles: number;

  @Field({ nullable: true })
  filesets?: number;

  @Field({ nullable: true })
  rolvCode?: string;

  @Field({ nullable: true })
  countryPopulation?: number;

  @Field(() => JSONScalar, { nullable: true })
  translations?: Record<string, string>;
}
