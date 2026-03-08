import {
  Entity,
  Enum,
  ManyToOne,
  PrimaryKey,
  Property,
} from "@mikro-orm/core";
import { ObjectId } from "@mikro-orm/mongodb";
import { Field, ID, ObjectType, InputType, registerEnumType } from "type-graphql";
import { WorshipService } from "./WorshipService";
import { TeamMember } from "./TeamMember";
import { TeamRole } from "./TeamMember";

export enum AssignmentStatus {
  PENDING = "pending",
  ACCEPTED = "accepted",
  DECLINED = "declined",
}

registerEnumType(AssignmentStatus, {
  name: "AssignmentStatus",
  description: "Status of a service assignment",
});

@Entity()
@ObjectType()
export class ServiceAssignment {
  @Field(() => ID)
  @PrimaryKey()
  _id!: ObjectId;

  @Field(() => String)
  @Property({ type: "date" })
  createdAt? = new Date();

  @Field(() => String)
  @Property({ type: "date", onUpdate: () => new Date() })
  updatedAt? = new Date();

  @Field(() => WorshipService)
  @ManyToOne(() => WorshipService)
  service!: WorshipService;

  @Field(() => TeamMember)
  @ManyToOne(() => TeamMember)
  member!: TeamMember;

  @Field(() => TeamRole)
  @Enum(() => TeamRole)
  @Property()
  role!: TeamRole;

  @Field(() => AssignmentStatus)
  @Enum(() => AssignmentStatus)
  @Property()
  status?: AssignmentStatus = AssignmentStatus.PENDING;

  @Field(() => String, { nullable: true })
  @Property({ nullable: true })
  notes?: string;
}

@InputType()
export class ServiceAssignmentInput {
  @Field(() => String)
  serviceId!: string;

  @Field(() => String)
  memberId!: string;

  @Field(() => TeamRole)
  role!: TeamRole;

  @Field(() => String, { nullable: true })
  notes?: string;
}
