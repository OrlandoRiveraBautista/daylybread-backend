import { BBLanguage } from "../../../misc/biblebrain/languagesTypes";
import { BBMetadata } from "../../../misc/biblebrain/metadataTypes";
import { BBBible } from "../../../misc/biblebrain/bibleTypes";
import { BBBook } from "../../../misc/biblebrain/bookTypes";
import { ObjectType, Field } from "type-graphql";

@ObjectType()
export class LanguageReponse {
  @Field(() => [BBLanguage])
  data: [BBLanguage];

  @Field(() => BBMetadata)
  meta: BBMetadata;
}

@ObjectType()
export class BibleReponse {
  @Field(() => [BBBible])
  data: [BBBible];

  @Field(() => BBMetadata)
  meta: BBMetadata;
}

@ObjectType()
export class BookResponse {
  @Field(() => [BBBook])
  data: [BBBook];
}
