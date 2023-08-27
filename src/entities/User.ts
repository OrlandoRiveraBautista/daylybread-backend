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

  @Field(() => String)
  @Property({ fieldName: "first_name", nullable: true })
  firstName?: string;

  @Field(() => String)
  @Property({ fieldName: "last_name", nullable: true })
  lastName?: string;

  @Field(() => String)
  @Property({ nullable: true })
  gender?: string;

  @Field(() => Number)
  @Property()
  count?: number;
}
