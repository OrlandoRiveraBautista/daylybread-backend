import { Entity, PrimaryKey, Property } from "@mikro-orm/core";
import { ObjectId } from "@mikro-orm/mongodb";
import { Field, ID, ObjectType } from "type-graphql";
import { TranslationField } from "./Book";

@ObjectType()
export class ChapterVerse {
  @Field(() => String)
  @Property()
  verse: string;

  @Field(() => String)
  @Property()
  bibleId: string;

  @Field(() => String)
  @Property()
  text: string;
}

@Entity()
@ObjectType()
export class Chapter {
  @Field(() => ID)
  @PrimaryKey()
  _id!: ObjectId;

  @Field(() => TranslationField)
  @Property()
  translation!: TranslationField;

  @Field(() => String)
  @Property()
  bookName!: string;

  @Field(() => String)
  @Property()
  chapterNumber!: string;

  @Field(() => String)
  @Property()
  bibleId!: string;

  @Field(() => [ChapterVerse])
  @Property()
  verses!: ChapterVerse[];
}
