import { Entity, ManyToOne, PrimaryKey, Property } from "@mikro-orm/core";
import { ObjectId } from "@mikro-orm/mongodb";
import { Field, ID, ObjectType, registerEnumType } from "type-graphql";
import { User } from "./User";

export enum InteractionType {
  HIGHLIGHT = "highlight",
  NOTE = "note",
  BOOKMARK = "bookmark",
}

registerEnumType(InteractionType, {
  name: "InteractionType",
  description: "Type of interaction with a Bible verse",
});

@Entity()
@ObjectType()
export class BibleInteraction {
  @Field(() => ID)
  @PrimaryKey()
  _id!: ObjectId;

  @Field(() => User)
  @ManyToOne(() => User)
  user: User;

  @Field(() => String)
  @Property()
  bibleId: string;

  @Field(() => InteractionType)
  @Property()
  type: InteractionType;

  @Field(() => String)
  @Property()
  book: string;

  @Field(() => Number)
  @Property()
  chapter: number;

  @Field(() => Number)
  @Property()
  verse: number;

  @Field(() => String, { nullable: true })
  @Property({ nullable: true })
  content?: string;

  @Field(() => Date)
  @Property({ type: "date" })
  createdAt = new Date();

  @Field(() => Date, { nullable: true })
  @Property({ type: "date", onUpdate: () => new Date(), nullable: true })
  updatedAt?: Date;
}
