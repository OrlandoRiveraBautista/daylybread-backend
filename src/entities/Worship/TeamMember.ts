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

export enum TeamRole {
  WORSHIP_LEADER = "worship_leader",
  GUITAR = "guitar",
  BASS = "bass",
  PIANO = "piano",
  DRUMS = "drums",
  VOCALS = "vocals",
  KEYS = "keys",
  ELECTRIC_GUITAR = "electric_guitar",
  ACOUSTIC_GUITAR = "acoustic_guitar",
  SOUND = "sound",
  MEDIA = "media",
  OTHER = "other",
}

registerEnumType(TeamRole, {
  name: "TeamRole",
  description: "Role of a team member in a worship team",
});

@Entity()
@ObjectType()
export class TeamMember {
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
  user!: User;

  @Field(() => TeamRole)
  @Enum(() => TeamRole)
  @Property()
  role: TeamRole = TeamRole.OTHER;

  @Field(() => [String], { nullable: true })
  @Property({ nullable: true })
  skills?: string[];
}

@InputType()
export class TeamMemberInput {
  @Field(() => String)
  userId!: string;

  @Field(() => String)
  teamId!: string;

  @Field(() => TeamRole)
  role!: TeamRole;

  @Field(() => [String], { nullable: true })
  skills?: string[];
}

@InputType()
export class UpdateTeamMemberInput {
  @Field(() => TeamRole, { nullable: true })
  role?: TeamRole;

  @Field(() => [String], { nullable: true })
  skills?: string[];
}
