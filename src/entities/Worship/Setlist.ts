import {
  Collection,
  Entity,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryKey,
  Property,
} from "@mikro-orm/core";
import { ObjectId } from "@mikro-orm/mongodb";
import { Field, ID, ObjectType, InputType } from "type-graphql";
import { User } from "../User";
import { WorshipService } from "./WorshipService";
import { SetlistItem } from "./SetlistItem";

@Entity()
@ObjectType()
export class Setlist {
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
  name!: string;

  @Field(() => WorshipService)
  @OneToOne(() => WorshipService, undefined, { owner: true })
  service!: WorshipService;

  @Field(() => [SetlistItem], { nullable: true })
  @OneToMany(() => SetlistItem, (item) => item.setlist)
  items = new Collection<SetlistItem>(this);
}

@InputType()
export class SetlistInput {
  @Field(() => String)
  name!: string;

  @Field(() => String)
  serviceId!: string;
}
