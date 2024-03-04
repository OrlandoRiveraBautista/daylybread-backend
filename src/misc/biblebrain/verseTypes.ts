import { Field, ObjectType } from "type-graphql";

@ObjectType()
export class BBVerse {
  @Field()
  bookId: string;

  @Field()
  bookName: string;

  @Field()
  bookNameAlt: string;

  @Field()
  chapter: number;

  @Field()
  chapterAlt: string;

  @Field()
  verseStart: number;

  @Field()
  verseStartAlt: string;

  @Field()
  verseEnd: number;

  @Field()
  verseEndAlt: string;

  @Field()
  verseText: string;
}
