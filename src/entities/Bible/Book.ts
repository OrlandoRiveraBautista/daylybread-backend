import { Entity, PrimaryKey, Property } from "@mikro-orm/core";
import { ObjectId } from "@mikro-orm/mongodb";
import { Field, ID, ObjectType } from "type-graphql";

@ObjectType()
export class TranslationField {
  @Field(() => String)
  @Property()
  name: string;

  @Field(() => String)
  @Property()
  abbreviation: string;
}

@ObjectType()
export class BookChapter {
  @Field(() => String)
  @Property()
  chapterName: string;

  @Field(() => String)
  @Property()
  bibleId: string;
}

@Entity()
@ObjectType()
export class Book {
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
  bibleId!: string;

  @Field(() => [BookChapter])
  @Property()
  chapters!: BookChapter[];
}
