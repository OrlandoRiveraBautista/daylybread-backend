import { Field, ObjectType } from "type-graphql";

@ObjectType()
export class BBAudioFile {
  @Field({ nullable: true })
  book_id?: string;

  @Field({ nullable: true })
  book_name?: string;

  @Field({ nullable: true })
  chapter_start?: number;

  @Field({ nullable: true })
  chapter_end?: number;

  @Field({ nullable: true })
  verse_start?: number;

  @Field({ nullable: true })
  verse_end?: number;

  @Field({ nullable: true })
  thumbnail?: string;

  @Field({ nullable: true })
  timestamp?: string;

  @Field({ nullable: true })
  path?: string;

  @Field({ nullable: true })
  duration?: number;
}
