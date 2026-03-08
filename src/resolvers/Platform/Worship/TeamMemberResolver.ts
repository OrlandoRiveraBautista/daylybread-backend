import {
  Resolver,
  Query,
  Arg,
  Ctx,
  Mutation,
  Field,
  ObjectType,
} from "type-graphql";
import { TeamMember, TeamMemberInput, UpdateTeamMemberInput } from "../../../entities/Worship/TeamMember";
import { WorshipTeam } from "../../../entities/Worship/WorshipTeam";
import { MyContext } from "../../../types";
import { ObjectId } from "@mikro-orm/mongodb";
import { User } from "../../../entities/User";
import { FieldError } from "../../../entities/Errors/FieldError";
import { ValidateUser } from "../../../middlewares/userAuth";

@ObjectType()
class TeamMemberResponse {
  @Field(() => TeamMember, { nullable: true })
  results?: TeamMember;

  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];
}

@ObjectType()
class TeamMembersResponse {
  @Field(() => [TeamMember], { nullable: true })
  results?: TeamMember[];

  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];
}

@Resolver()
export class TeamMemberResolver {
  @ValidateUser()
  @Query(() => TeamMembersResponse)
  async getTeamMembers(
    @Arg("teamId") teamId: string,
    @Ctx() { em, request }: MyContext
  ): Promise<TeamMembersResponse> {
    const req = request as any;

    if (!req.userId) {
      return {
        errors: [
          {
            field: "User",
            message: "User cannot be found. Please login first.",
          },
        ],
      };
    }

    // Verify user is the team author or a member
    const team = await em.findOne(WorshipTeam, { _id: new ObjectId(teamId) }, { populate: ["author"] });
    if (!team) {
      return {
        errors: [{ field: "WorshipTeam", message: "Team not found" }],
      };
    }

    const isAuthor = team.author._id.equals(req.userId);
    const isMember = await em.findOne(TeamMember, {
      team: new ObjectId(teamId),
      user: req.userId,
    });

    if (!isAuthor && !isMember) {
      return {
        errors: [{ field: "WorshipTeam", message: "You do not have access to this team" }],
      };
    }

    const members = await em.find(
      TeamMember,
      { team: new ObjectId(teamId) },
      { populate: ["user", "team"], orderBy: { createdAt: "DESC" } }
    );

    return { results: members };
  }

  @ValidateUser()
  @Mutation(() => TeamMemberResponse)
  async addTeamMember(
    @Arg("options", () => TeamMemberInput) options: TeamMemberInput,
    @Ctx() { em, request }: MyContext
  ): Promise<TeamMemberResponse> {
    const req = request as any;

    if (!req.userId) {
      return {
        errors: [
          {
            field: "User",
            message: "User cannot be found. Please login first.",
          },
        ],
      };
    }

    const team = await em.findOne(WorshipTeam, { _id: new ObjectId(options.teamId) }, { populate: ["author"] });
    if (!team) {
      return {
        errors: [{ field: "WorshipTeam", message: "Team not found" }],
      };
    }

    if (!team.author._id.equals(req.userId)) {
      return {
        errors: [{ field: "WorshipTeam", message: "Only the team owner can add members" }],
      };
    }

    const user = await em.findOne(User, { _id: new ObjectId(options.userId) });
    if (!user) {
      return {
        errors: [{ field: "User", message: "User not found" }],
      };
    }

    // Check if user is already a member of this team
    const existing = await em.findOne(TeamMember, {
      team: new ObjectId(options.teamId),
      user: new ObjectId(options.userId),
    });

    if (existing) {
      return {
        errors: [{ field: "TeamMember", message: "User is already a member of this team" }],
      };
    }

    const member = em.create(TeamMember, {
      team,
      user,
      role: options.role,
      skills: options.skills,
    });

    try {
      await em.persistAndFlush(member);
      await em.populate(member, ["user", "team"]);
    } catch (err) {
      console.error("Error adding team member:", err);
      return {
        errors: [{ field: "TeamMember", message: "Failed to add team member" }],
      };
    }

    return { results: member };
  }

  @ValidateUser()
  @Mutation(() => TeamMemberResponse)
  async updateTeamMember(
    @Arg("id") id: string,
    @Arg("options", () => UpdateTeamMemberInput) options: UpdateTeamMemberInput,
    @Ctx() { em, request }: MyContext
  ): Promise<TeamMemberResponse> {
    const req = request as any;

    if (!req.userId) {
      return {
        errors: [
          {
            field: "User",
            message: "User cannot be found. Please login first.",
          },
        ],
      };
    }

    const member = await em.findOne(TeamMember, { _id: new ObjectId(id) }, { populate: ["team", "team.author"] });

    if (!member) {
      return {
        errors: [{ field: "TeamMember", message: "Team member not found" }],
      };
    }

    if (!member.team.author._id.equals(req.userId)) {
      return {
        errors: [{ field: "WorshipTeam", message: "Only the team owner can update members" }],
      };
    }

    try {
      const updateData: any = {};
      if (options.role !== undefined) updateData.role = options.role;
      if (options.skills !== undefined) updateData.skills = options.skills;

      em.assign(member, updateData);
      await em.persistAndFlush(member);
      await em.populate(member, ["user", "team"]);
    } catch (err) {
      console.error("Error updating team member:", err);
      return {
        errors: [{ field: "TeamMember", message: "Failed to update team member" }],
      };
    }

    return { results: member };
  }

  @ValidateUser()
  @Mutation(() => TeamMemberResponse)
  async removeTeamMember(
    @Arg("id") id: string,
    @Ctx() { em, request }: MyContext
  ): Promise<TeamMemberResponse> {
    const req = request as any;

    if (!req.userId) {
      return {
        errors: [
          {
            field: "User",
            message: "User cannot be found. Please login first.",
          },
        ],
      };
    }

    const member = await em.findOne(TeamMember, { _id: new ObjectId(id) }, { populate: ["team", "team.author"] });

    if (!member) {
      return {
        errors: [{ field: "TeamMember", message: "Team member not found" }],
      };
    }

    if (!member.team.author._id.equals(req.userId)) {
      return {
        errors: [{ field: "WorshipTeam", message: "Only the team owner can remove members" }],
      };
    }

    try {
      await em.removeAndFlush(member);
    } catch (err) {
      console.error("Error removing team member:", err);
      return {
        errors: [{ field: "TeamMember", message: "Failed to remove team member" }],
      };
    }

    return { results: member };
  }
}
