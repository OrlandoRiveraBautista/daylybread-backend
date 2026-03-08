import {
  Entity,
  ManyToOne,
  PrimaryKey,
  Property,
} from "@mikro-orm/core";
import { ObjectId } from "@mikro-orm/mongodb";
import { Field, ID, ObjectType, InputType } from "type-graphql";
import { Setlist } from "./Setlist";
import { Song } from "./Song";

@Entity()
@ObjectType()
export class SetlistItem {
  @Field(() => ID)
  @PrimaryKey()
  _id!: ObjectId;

  @Field(() => String)
  @Property({ type: "date" })
  createdAt? = new Date();

  @Field(() => String)
  @Property({ type: "date", onUpdate: () => new Date() })
  updatedAt? = new Date();

  @Field(() => Setlist)
  @ManyToOne(() => Setlist)
  setlist!: Setlist;

  @Field(() => Song)
  @ManyToOne(() => Song)
  song!: Song;

  @Field(() => Number)
  @Property()
  order!: number;

  @Field(() => String, { nullable: true })
  @Property({ nullable: true })
  key?: string;

  @Field(() => Number, { nullable: true })
  @Property({ nullable: true })
  bpm?: number;

  @Field(() => String, { nullable: true })
  @Property({ nullable: true })
  notes?: string;
}

@InputType()
export class SetlistItemInput {
  @Field(() => String)
  songId!: string;

  @Field(() => Number)
  order!: number;

  @Field(() => String, { nullable: true })
  key?: string;

  @Field(() => Number, { nullable: true })
  bpm?: number;

  @Field(() => String, { nullable: true })
  notes?: string;
}
