import {
  Resolver,
  Arg,
  Ctx,
  Mutation,
  Field,
  ObjectType,
} from "type-graphql";
import { ServiceAssignment, ServiceAssignmentInput, AssignmentStatus } from "../../../entities/Worship/ServiceAssignment";
import { WorshipService } from "../../../entities/Worship/WorshipService";
import { WorshipTeam } from "../../../entities/Worship/WorshipTeam";
import { TeamMember } from "../../../entities/Worship/TeamMember";
import { MyContext } from "../../../types";
import { ObjectId } from "@mikro-orm/mongodb";
import { FieldError } from "../../../entities/Errors/FieldError";
import { ValidateUser } from "../../../middlewares/userAuth";

@ObjectType()
class ServiceAssignmentResponse {
  @Field(() => ServiceAssignment, { nullable: true })
  results?: ServiceAssignment;

  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];
}

@Resolver()
export class ServiceAssignmentResolver {
  @ValidateUser()
  @Mutation(() => ServiceAssignmentResponse)
  async createServiceAssignment(
    @Arg("options", () => ServiceAssignmentInput) options: ServiceAssignmentInput,
    @Ctx() { em, request }: MyContext
  ): Promise<ServiceAssignmentResponse> {
    const req = request as any;

    if (!req.userId) {
      return {
        errors: [{ field: "User", message: "User cannot be found. Please login first." }],
      };
    }

    const service = await em.findOne(WorshipService, { _id: new ObjectId(options.serviceId) }, { populate: ["team"] });
    if (!service) {
      return {
        errors: [{ field: "WorshipService", message: "Service not found" }],
      };
    }

    // Verify user is team author or member
    const assignTeam = await em.findOne(WorshipTeam, { _id: service.team._id }, { populate: ["author"] });
    const isAssignAuthor = assignTeam?.author._id.equals(req.userId);
    const isAssignMember = await em.findOne(TeamMember, { team: service.team._id, user: req.userId });
    if (!isAssignAuthor && !isAssignMember) {
      return {
        errors: [{ field: "WorshipTeam", message: "You do not have access to this team" }],
      };
    }

    const member = await em.findOne(TeamMember, { _id: new ObjectId(options.memberId) });
    if (!member) {
      return {
        errors: [{ field: "TeamMember", message: "Team member not found" }],
      };
    }

    // Check for duplicate assignment
    const existing = await em.findOne(ServiceAssignment, {
      service: new ObjectId(options.serviceId),
      member: new ObjectId(options.memberId),
    });

    if (existing) {
      return {
        errors: [{ field: "ServiceAssignment", message: "This member is already assigned to this service" }],
      };
    }

    const assignment = em.create(ServiceAssignment, {
      service,
      member,
      role: options.role,
      notes: options.notes,
    });

    try {
      await em.persistAndFlush(assignment);
      await em.populate(assignment, ["service", "member", "member.user"]);
    } catch (err) {
      console.error("Error creating service assignment:", err);
      return {
        errors: [{ field: "ServiceAssignment", message: "Failed to create assignment" }],
      };
    }

    return { results: assignment };
  }

  @ValidateUser()
  @Mutation(() => ServiceAssignmentResponse)
  async respondToAssignment(
    @Arg("assignmentId") assignmentId: string,
    @Arg("accept") accept: boolean,
    @Ctx() { em, request }: MyContext
  ): Promise<ServiceAssignmentResponse> {
    const req = request as any;

    if (!req.userId) {
      return {
        errors: [{ field: "User", message: "User cannot be found. Please login first." }],
      };
    }

    const assignment = await em.findOne(
      ServiceAssignment,
      { _id: new ObjectId(assignmentId) },
      { populate: ["member", "member.user"] }
    );

    if (!assignment) {
      return {
        errors: [{ field: "ServiceAssignment", message: "Assignment not found" }],
      };
    }

    // Verify the current user is the assigned member
    if (assignment.member.user._id.toString() !== req.userId.toString()) {
      return {
        errors: [{ field: "ServiceAssignment", message: "You can only respond to your own assignments" }],
      };
    }

    assignment.status = accept ? AssignmentStatus.ACCEPTED : AssignmentStatus.DECLINED;

    try {
      await em.persistAndFlush(assignment);
      await em.populate(assignment, ["service", "member", "member.user"]);
    } catch (err) {
      console.error("Error responding to assignment:", err);
      return {
        errors: [{ field: "ServiceAssignment", message: "Failed to respond to assignment" }],
      };
    }

    return { results: assignment };
  }

  @ValidateUser()
  @Mutation(() => ServiceAssignmentResponse)
  async removeServiceAssignment(
    @Arg("id") id: string,
    @Ctx() { em, request }: MyContext
  ): Promise<ServiceAssignmentResponse> {
    const req = request as any;

    if (!req.userId) {
      return {
        errors: [{ field: "User", message: "User cannot be found. Please login first." }],
      };
    }

    const assignment = await em.findOne(ServiceAssignment, { _id: new ObjectId(id) }, { populate: ["service", "service.team"] });

    if (!assignment) {
      return {
        errors: [{ field: "ServiceAssignment", message: "Assignment not found" }],
      };
    }

    // Only the team owner or service author can remove assignments
    const rmTeam = await em.findOne(WorshipTeam, { _id: assignment.service.team._id }, { populate: ["author"] });
    if (!rmTeam?.author._id.equals(req.userId)) {
      return {
        errors: [{ field: "WorshipTeam", message: "Only the team owner can remove assignments" }],
      };
    }

    try {
      await em.removeAndFlush(assignment);
    } catch (err) {
      console.error("Error removing assignment:", err);
      return {
        errors: [{ field: "ServiceAssignment", message: "Failed to remove assignment" }],
      };
    }

    return { results: assignment };
  }
}
