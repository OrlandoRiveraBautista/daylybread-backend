import { BBLanguage } from "../../../misc/biblebrain/languagesTypes";
import { BBMetadata } from "../../../misc/biblebrain/metadataTypes";
import { BBBible } from "../../../misc/biblebrain/bibleTypes";
import { BBBook } from "../../../misc/biblebrain/bookTypes";
import { BBVerse } from "../../../misc/biblebrain/verseTypes";
import { ObjectType, Field } from "type-graphql";
import { BBCopyright } from "../../../misc/biblebrain/copyrightTypes";
import { BBAudioFile } from "../../../misc/biblebrain/mediaTypes";

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

@ObjectType()
export class VerseResponse {
  @Field(() => [BBVerse])
  data: [BBVerse];
}

@ObjectType()
export class CopyrightResponse {
  @Field(() => [BBCopyright])
  data: [BBCopyright];
}

@ObjectType()
export class AudioMediaResponse {
  @Field(() => [BBAudioFile])
  data: [BBAudioFile];
}
