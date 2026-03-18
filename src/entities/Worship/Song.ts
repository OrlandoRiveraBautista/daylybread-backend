import {
  Entity,
  ManyToOne,
  PrimaryKey,
  Property,
} from "@mikro-orm/core";
import { ObjectId } from "@mikro-orm/mongodb";
import { Field, ID, ObjectType, InputType } from "type-graphql";
import { User } from "../User";

@Entity()
@ObjectType()
export class Song {
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
  author!: User;

  @Field(() => String)
  @Property()
  title!: string;

  @Field(() => String, { nullable: true })
  @Property({ nullable: true })
  artist?: string;

  @Field(() => String, { nullable: true })
  @Property({ nullable: true })
  defaultKey?: string;

  @Field(() => Number, { nullable: true })
  @Property({ nullable: true })
  bpm?: number;

  @Field(() => String, { nullable: true })
  @Property({ type: "text", nullable: true })
  lyrics?: string;

  @Field(() => String, { nullable: true })
  @Property({ type: "text", nullable: true })
  chordChart?: string;

  @Field(() => String, { nullable: true })
  @Property({ nullable: true })
  youtubeLink?: string;

  @Field(() => String, { nullable: true })
  @Property({ nullable: true })
  notes?: string;

  @Field(() => String, { nullable: true })
  @Property({ nullable: true })
  chordsUrl?: string;
}

@InputType()
export class SongInput {
  @Field(() => String)
  title!: string;

  @Field(() => String, { nullable: true })
  artist?: string;

  @Field(() => String, { nullable: true })
  defaultKey?: string;

  @Field(() => Number, { nullable: true })
  bpm?: number;

  @Field(() => String, { nullable: true })
  lyrics?: string;

  @Field(() => String, { nullable: true })
  chordChart?: string;

  @Field(() => String, { nullable: true })
  youtubeLink?: string;

  @Field(() => String, { nullable: true })
  notes?: string;

  @Field(() => String, { nullable: true })
  chordsUrl?: string;
}
