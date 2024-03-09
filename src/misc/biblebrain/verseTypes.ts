import { Field, ObjectType } from "type-graphql";

@ObjectType()
export class BBVerse {
  @Field({ nullable: true })
  bookId?: string;

  @Field({ nullable: true })
  bookName?: string;

  @Field({ nullable: true })
  bookNameAlt?: string;

  @Field({ nullable: true })
  chapter?: number;

  @Field({ nullable: true })
  chapterAlt?: string;

  @Field({ nullable: true })
  verseStart?: number;

  @Field({ nullable: true })
  verseStartAlt?: string;

  @Field({ nullable: true })
  verseEnd?: number;

  @Field({ nullable: true })
  verseEndAlt?: string;

  @Field({ nullable: true })
  verseText?: string;
}
