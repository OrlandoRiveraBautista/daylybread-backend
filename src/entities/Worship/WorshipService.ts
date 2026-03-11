import {
  Collection,
  Entity,
  Enum,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryKey,
  Property,
} from "@mikro-orm/core";
import { ObjectId } from "@mikro-orm/mongodb";
import { Field, ID, ObjectType, InputType, registerEnumType } from "type-graphql";
import { User } from "../User";
import { WorshipTeam } from "./WorshipTeam";
import { ServiceAssignment } from "./ServiceAssignment";
import { Setlist } from "./Setlist";

export enum ServiceStatus {
  DRAFT = "draft",
  SCHEDULED = "scheduled",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

registerEnumType(ServiceStatus, {
  name: "ServiceStatus",
  description: "Status of a worship service",
});

@Entity()
@ObjectType()
export class WorshipService {
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

  @Field(() => String)
  @Property({ type: "date" })
  date!: Date;

  @Field(() => WorshipTeam)
  @ManyToOne(() => WorshipTeam)
  team!: WorshipTeam;

  @Field(() => String, { nullable: true })
  @Property({ nullable: true })
  notes?: string;

  @Field(() => ServiceStatus)
  @Enum(() => ServiceStatus)
  @Property()
  status?: ServiceStatus = ServiceStatus.DRAFT;

  @Field(() => [ServiceAssignment], { nullable: true })
  @OneToMany(() => ServiceAssignment, (assignment) => assignment.service)
  assignments = new Collection<ServiceAssignment>(this);

  @Field(() => Setlist, { nullable: true })
  @OneToOne(() => Setlist, (setlist) => setlist.service, { nullable: true, owner: false })
  setlist?: Setlist;
}

@InputType()
export class WorshipServiceInput {
  @Field(() => String)
  name!: string;

  @Field(() => String)
  date!: string;

  @Field(() => String)
  teamId!: string;

  @Field(() => String, { nullable: true })
  notes?: string;

  @Field(() => ServiceStatus, { nullable: true })
  status?: ServiceStatus;
}
