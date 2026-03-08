import {
  Entity,
  ManyToOne,
  PrimaryKey,
  Property,
} from "@mikro-orm/core";
import { ObjectId } from "@mikro-orm/mongodb";
import { Field, ID, ObjectType, InputType } from "type-graphql";
import { User } from "../User";
import { WorshipTeam } from "./WorshipTeam";

@Entity()
@ObjectType()
export class Rehearsal {
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

  @Field(() => WorshipTeam)
  @ManyToOne(() => WorshipTeam)
  team!: WorshipTeam;

  @Field(() => String)
  @Property({ type: "date" })
  date!: Date;

  @Field(() => String, { nullable: true })
  @Property({ nullable: true })
  notes?: string;

  @Field(() => [String], { nullable: true })
  @Property({ nullable: true })
  songIds?: string[];
}

@InputType()
export class RehearsalInput {
  @Field(() => String)
  teamId!: string;

  @Field(() => String)
  date!: string;

  @Field(() => String, { nullable: true })
  notes?: string;

  @Field(() => [String], { nullable: true })
  songIds?: string[];
}
