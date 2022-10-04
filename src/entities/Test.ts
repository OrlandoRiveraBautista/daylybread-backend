import { Entity, PrimaryKey, Property } from "@mikro-orm/core";
import { ObjectId } from "@mikro-orm/mongodb";
import { Field, ID, ObjectType } from "type-graphql";

@Entity()
@ObjectType()
export class Test {
  @Field(() => ID)
  @PrimaryKey()
  _id!: ObjectId;

  @Field(() => String)
  @Property({ fieldName: "first_name" })
  firstName!: string;

  @Field(() => String)
  @Property({ fieldName: "last_name" })
  lastName!: string;

  @Field(() => String)
  @Property()
  gender!: string;

  @Field(() => String)
  @Property()
  email!: string;

  @Field(() => String)
  @Property({ fieldName: "ip_address" })
  ipAddress!: string;
}
