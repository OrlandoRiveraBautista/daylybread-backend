import {
  Collection,
  Entity,
  ManyToOne,
  PrimaryKey,
  Property,
  ManyToMany,
} from "@mikro-orm/core";
import { ObjectId } from "@mikro-orm/mongodb";
import { Field, ID, ObjectType } from "type-graphql";
import { User } from "./User";
import { Verse } from "./Bible/Verse";
import { BBVerse } from "../misc/biblebrain/verseTypes";

@Entity()
@ObjectType()
export class Bookmark {
  @Field(() => ID)
  @PrimaryKey()
  _id!: ObjectId;

  @Field(() => String)
  @Property({ type: "date" })
  createdAt? = new Date();

  @Field(() => String)
  @Property({ type: "date", onUpdate: () => new Date() })
  updatedAt? = new Date();

  @Field(() => User)
  @ManyToOne(() => User)
  author: User;

  @Field(() => String, { nullable: true })
  @Property({ nullable: true })
  bibleId?: string;

  @Field(() => Number, { nullable: true })
  @Property({ nullable: true })
  languageId?: number;

  @Field(() => [BBVerse], { nullable: true })
  @Property({ nullable: true })
  newVerses?: BBVerse[];

  @Field(() => [Verse])
  @ManyToMany(() => Verse)
  verses = new Collection<Verse>(this);

  @Field(() => String, { nullable: true })
  @Property({ nullable: true })
  note?: string;
}
