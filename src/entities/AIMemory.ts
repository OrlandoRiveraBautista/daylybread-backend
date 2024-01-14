import {
  Entity,
  ManyToOne,
  PrimaryKey,
  Property,
  Unique,
} from "@mikro-orm/core";
import { ObjectId } from "@mikro-orm/mongodb";
import { Field, ID, ObjectType } from "type-graphql";
import { User } from "./User";
import { StoredMessage } from "langchain/schema";

@Entity()
@ObjectType()
export class AIMessage {
  @Field(() => ID)
  @PrimaryKey()
  _id!: ObjectId;

  @Field(() => User)
  @ManyToOne(() => User)
  owner: User;

  @Field(() => String)
  @Property()
  @Unique()
  chatId: string;

  @Field(() => Array<StoredMessage>)
  @Property()
  messages: StoredMessage[];

  @Field(() => String)
  @Property({ type: "date" })
  createdAt? = new Date();

  @Field(() => String)
  @Property({ type: "date", onUpdate: () => new Date() })
  updatedAt? = new Date();
}
