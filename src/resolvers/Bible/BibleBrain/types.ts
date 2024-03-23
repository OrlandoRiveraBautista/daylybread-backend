import { BBLanguage } from "../../../misc/biblebrain/languagesTypes";
import { BBMetadata } from "../../../misc/biblebrain/metadataTypes";
import { ObjectType, Field } from "type-graphql";

@ObjectType()
export class LanguageReponse {
  @Field(() => [BBLanguage])
  data: [BBLanguage];

  @Field(() => BBMetadata)
  meta: BBMetadata;
}
