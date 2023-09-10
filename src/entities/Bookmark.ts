import { Entity, ManyToOne, PrimaryKey, Property } from "@mikro-orm/core";
import { ObjectId } from "@mikro-orm/mongodb";
import { Field, ID, ObjectType } from "type-graphql";
import { User } from "./User";

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

  @Field(() => String, { nullable: true })
  @Property({ nullable: true })
  note?: string;

  @Field(() => User)
  @ManyToOne(() => User)
  author: User;

  // we will store user images in another table
  // this table will reference the user by id and have the image url from s3 and have a default boolean field to specify the profile pic
}
