import { Entity, PrimaryKey, Property } from "@mikro-orm/core";
import { ObjectId } from "@mikro-orm/mongodb";
import { Field, ID, ObjectType } from "type-graphql";
import { TranslationField } from "./Book";

export interface ITimeRange {
  minutes: number;
  seconds: number;
}

@ObjectType()
class TimeRange {
  @Field(() => Number)
  @Property()
  minutes: number;

  @Field(() => Number)
  @Property()
  seconds: number;
}

@ObjectType()
class ITimestamps {
  @Field(() => TimeRange)
  @Property()
  start: TimeRange;

  @Field(() => TimeRange)
  @Property()
  end: TimeRange;
}

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

  @Field(() => ITimestamps)
  @Property()
  audioTimestamp: ITimestamps;
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

  @Field(() => String)
  @Property()
  audioLink: string;

  @Field(() => [ChapterVerse])
  @Property()
  verses!: ChapterVerse[];
}
