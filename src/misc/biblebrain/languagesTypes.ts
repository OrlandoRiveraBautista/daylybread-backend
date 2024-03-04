import { JSONScalar } from "../../types";
import { Field, ObjectType } from "type-graphql";

@ObjectType()
export class BBLanguage {
  @Field()
  id: number;

  @Field(() => String)
  glottoId: string;

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
  rolvCode: string;

  @Field()
  countryPopulation: number;

  @Field(() => JSONScalar)
  translations: Record<string, string>;
}
