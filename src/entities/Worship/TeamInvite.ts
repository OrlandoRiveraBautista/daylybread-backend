import {
  Entity,
  Enum,
  ManyToOne,
  PrimaryKey,
  Property,
} from "@mikro-orm/core";
import { ObjectId } from "@mikro-orm/mongodb";
import { Field, ID, ObjectType, InputType, registerEnumType } from "type-graphql";
import { User } from "../User";
import { WorshipTeam } from "./WorshipTeam";
import { TeamRole } from "./TeamMember";
import crypto from "crypto";

export enum InviteStatus {
  PENDING = "pending",
  ACCEPTED = "accepted",
  DECLINED = "declined",
  EXPIRED = "expired",
}

registerEnumType(InviteStatus, {
  name: "InviteStatus",
  description: "Status of a team invite",
});

export enum InviteMethod {
  EMAIL = "email",
  NOTIFICATION = "notification",
  BOTH = "both",
}

registerEnumType(InviteMethod, {
  name: "InviteMethod",
  description: "Method used to send the invite",
});

@Entity()
@ObjectType()
export class TeamInvite {
  @Field(() => ID)
  @PrimaryKey()
  _id!: ObjectId;

  @Field(() => String)
  @Property({ type: "date" })
  createdAt? = new Date();

  @Field(() => String)
  @Property({ type: "date", onUpdate: () => new Date() })
  updatedAt? = new Date();

  @Field(() => WorshipTeam)
  @ManyToOne(() => WorshipTeam)
  team!: WorshipTeam;

  @Field(() => User)
  @ManyToOne(() => User)
  invitedBy!: User;

  @Field(() => User, { nullable: true })
  @ManyToOne(() => User, { nullable: true })
  invitedUser?: User;

  @Field(() => String, { nullable: true })
  @Property({ nullable: true })
  email?: string;

  @Field(() => TeamRole)
  @Enum(() => TeamRole)
  @Property()
  role: TeamRole = TeamRole.OTHER;

  @Field(() => InviteStatus)
  @Enum(() => InviteStatus)
  @Property()
  status?: InviteStatus = InviteStatus.PENDING;

  @Field(() => InviteMethod)
  @Enum(() => InviteMethod)
  @Property()
  method?: InviteMethod = InviteMethod.EMAIL;

  @Field(() => String)
  @Property()
  inviteToken?: string = crypto.randomBytes(32).toString("hex");

  @Field(() => String)
  @Property({ type: "date" })
  expiresAt?: Date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  @Field(() => [String], { nullable: true })
  @Property({ nullable: true })
  skills?: string[];
}

@InputType()
export class TeamInviteInput {
  @Field(() => String)
  teamId!: string;

  @Field(() => String, { nullable: true })
  email?: string;

  @Field(() => String, { nullable: true })
  userId?: string;

  @Field(() => TeamRole)
  role!: TeamRole;

  @Field(() => InviteMethod)
  method!: InviteMethod;

  @Field(() => [String], { nullable: true })
  skills?: string[];
}
