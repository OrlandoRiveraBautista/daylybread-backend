import {
  Collection,
  Entity,
  OneToMany,
  PrimaryKey,
  Property,
} from "@mikro-orm/core";
import { ObjectId } from "@mikro-orm/mongodb";
import { Field, ID, InputType, ObjectType } from "type-graphql";

/* Entities */
import { Bookmark } from "./Bookmark";

@Entity()
@ObjectType()
export class User {
  @Field(() => ID)
  @PrimaryKey()
  _id!: ObjectId;

  @Field(() => String)
  @Property({ type: "date" })
  createdAt? = new Date();

  @Field(() => String)
  @Property({ type: "date", onUpdate: () => new Date() })
  updatedAt? = new Date();

  @Field(() => String)
  @Property({ unique: true })
  email!: string;

  @Property()
  password!: string;

  @Field(() => String, { nullable: true })
  @Property({ nullable: true })
  firstName?: string;

  @Field(() => String, { nullable: true })
  @Property({ nullable: true })
  lastName?: string;

  @Field(() => String, { nullable: true })
  @Property({ nullable: true })
  churchName?: string;

  @Field(() => Date, { nullable: true })
  @Property({ nullable: true })
  dob?: Date;

  @Field(() => Number)
  @Property()
  count: number;

  @Field(() => [Bookmark], { nullable: true })
  @OneToMany(() => Bookmark, (bookmark) => bookmark.author)
  bookmarks = new Collection<Bookmark>(this);

  @Field(() => String, { nullable: true })
  @Property({ nullable: true })
  bioText?: string;
  // we will store user images in another table
  // this table will reference the user by id and have the image url from s3 and have a default boolean field to specify the profile pic
}

@InputType()
export class UserUpdateInput {
  @Field(() => String, { nullable: true })
  firstName?: string;

  @Field(() => String, { nullable: true })
  lastName?: string;

  @Field(() => String, { nullable: true })
  churchName?: string;

  @Field(() => Date, { nullable: true })
  dob?: Date;

  @Field(() => String, { nullable: true })
  bioText?: string;
}
