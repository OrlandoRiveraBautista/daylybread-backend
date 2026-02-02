import { Entity, PrimaryKey, Property, ManyToOne } from "@mikro-orm/core";
import { ObjectId } from "@mikro-orm/mongodb";
import { Field, ID, ObjectType, registerEnumType } from "type-graphql";
import { User } from "./User";

export enum SermonStatus {
  DRAFT = "draft",
  PUBLISHED = "published",
}

registerEnumType(SermonStatus, {
  name: "SermonStatus",
  description: "The status of a sermon",
});

@Entity()
@ObjectType()
export class Sermon {
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

  @Field(() => String)
  @Property({ type: "text" })
  content!: string; // Stores Tiptap JSON as a string

  @Field(() => SermonStatus)
  @Property({ type: "string" })
  status: SermonStatus = SermonStatus.DRAFT;
}
