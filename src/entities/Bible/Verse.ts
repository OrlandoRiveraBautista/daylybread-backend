import { Entity, PrimaryKey, Property } from "@mikro-orm/core";
import { ObjectId } from "@mikro-orm/mongodb";
import { Field, ID, ObjectType } from "type-graphql";
import { TranslationField } from "./Book";

@Entity()
@ObjectType()
export class Verse {
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
  verse!: string;

  @Field(() => String)
  @Property()
  text!: string;

  @Field(() => String)
  @Property()
  bibleId!: string;
}
