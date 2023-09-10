import { Entity, PrimaryKey, Property } from "@mikro-orm/core";
import { ObjectId } from "@mikro-orm/mongodb";
import { Field, ID, ObjectType } from "type-graphql";

@Entity()
@ObjectType()
export class User {
  @Field(() => ID)
  @PrimaryKey()
  _id!: ObjectId;

  @Field(() => String)
  @Property({ unique: true })
  handle: string;

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
  @Property({ fieldName: "first_name", nullable: true })
  firstName?: string;

  @Field(() => String, { nullable: true })
  @Property({ fieldName: "last_name", nullable: true })
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

  // we will store user images in another table
  // this table will reference the user by id and have the image url from s3 and have a default boolean field to specify the profile pic
}
