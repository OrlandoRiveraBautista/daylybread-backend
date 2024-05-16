import { ManyToOne, PrimaryKey, Property } from "@mikro-orm/core";
import { ObjectId } from "@mikro-orm/mongodb";
import { Field, ID, ObjectType } from "type-graphql";
import { User } from "../User";

@ObjectType()
export class History {
  @Field(() => Number)
  @Property()
  language: number;

  @Field(() => String)
  @Property()
  bibleId: string;

  @Field(() => String)
  @Property()
  bookId: string;

  @Field(() => Number)
  @Property()
  chapterNumber: number;

  @Field(() => String)
  @Property({ type: "date" })
  viewedAt = new Date();
}

@ObjectType()
export class BibleHistory {
  @Field(() => ID)
  @PrimaryKey()
  _id!: ObjectId;

  @Field(() => User)
  @ManyToOne(() => User)
  owner: User;

  @Field(() => [BibleHistory])
  history: BibleHistory[];

  @Field(() => Date)
  createdAt: Date;

  @Field(() => Date)
  updatedAt: Date;
}
