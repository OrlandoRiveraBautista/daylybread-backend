import { Entity, PrimaryKey, Property, Enum } from "@mikro-orm/core";
import { ObjectId } from "@mikro-orm/mongodb";
import { Field, ObjectType } from "type-graphql";

export enum MoodType {
  PEACEFUL = "peaceful",
  GRATEFUL = "grateful",
  DOWNCAST = "downcast",
  FRUSTRATED = "frustrated",
  ANXIOUS = "anxious",
  LOVED = "loved",
  GUILTY = "guilty",
  HOPEFUL = "hopeful",
}

@ObjectType()
@Entity()
export class MoodCache {
  @Field(() => String)
  @PrimaryKey()
  _id!: ObjectId;

  @Field(() => String)
  @Property()
  userId!: string;

  @Field(() => String)
  @Enum(() => MoodType)
  @Property()
  mood!: MoodType;

  @Field(() => String)
  @Property()
  verse!: string;

  @Field(() => String)
  @Property()
  reference!: string;

  @Field(() => String)
  @Property()
  reflection!: string;

  @Field(() => String, { nullable: true })
  @Property({ nullable: true })
  additionalContext?: string;

  @Field(() => String, { nullable: true })
  @Property({ nullable: true })
  preferredBibleVersion?: string;

  @Field(() => Date)
  @Property()
  createdAt: Date = new Date();

  @Field(() => Date)
  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  @Field(() => Date)
  @Property()
  expiresAt!: Date;

  constructor() {
    this._id = new ObjectId();
  }
}
