import {
  Resolver,
  Query,
  Arg,
  Ctx,
  Mutation,
  Field,
  ObjectType,
} from "type-graphql";
import { WorshipTeam, WorshipTeamInput } from "../../../entities/Worship/WorshipTeam";
import { TeamMember } from "../../../entities/Worship/TeamMember";
import { MyContext } from "../../../types";
import { ObjectId } from "@mikro-orm/mongodb";
import { User } from "../../../entities/User";
import { FieldError } from "../../../entities/Errors/FieldError";
import { RequireAuth } from "../../../middlewares/userAuth";
import { omitUndefined } from "../../../utility";

@ObjectType()
class WorshipTeamResponse {
  @Field(() => WorshipTeam, { nullable: true })
  results?: WorshipTeam;

  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];
}

@ObjectType()
class WorshipTeamsResponse {
  @Field(() => [WorshipTeam], { nullable: true })
  results?: WorshipTeam[];

  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];
}

@Resolver()
export class WorshipTeamResolver {
  @RequireAuth()
  @Query(() => WorshipTeamsResponse)
  async getWorshipTeams(
    @Ctx() { em, request }: MyContext
  ): Promise<WorshipTeamsResponse> {
    const req = request as any;

    // Find teams the user is a member of
    const memberships = await em.find(TeamMember, { user: req.userId });
    const memberTeamIds = memberships.map((m) => m.team._id);

    // Return teams where user is either the author or a member
    const teams = await em.find(
      WorshipTeam,
      {
        $or: [
          { author: req.userId },
          { _id: { $in: memberTeamIds } },
        ],
      },
      { orderBy: { updatedAt: "DESC" }, populate: ["author", "members", "members.user"] }
    );

    return { results: teams };
  }

  @RequireAuth()
  @Query(() => WorshipTeamResponse)
  async getWorshipTeam(
    @Arg("id") id: string,
    @Ctx() { em, request }: MyContext
  ): Promise<WorshipTeamResponse> {
    const req = request as any;

    const team = await em.findOne(
      WorshipTeam,
      { _id: new ObjectId(id) },
      { populate: ["author", "members", "members.user"] }
    );

    if (!team) {
      return {
        errors: [
          {
            field: "WorshipTeam",
            message: "Team not found",
          },
        ],
      };
    }

    // Verify user is the author or a member of this team
    const isAuthor = team.author._id.equals(req.userId);
    const isMember = team.members.getItems().some(
      (m) => m.user?._id.equals(req.userId)
    );

    if (!isAuthor && !isMember) {
      return {
        errors: [
          {
            field: "WorshipTeam",
            message: "You do not have access to this team",
          },
        ],
      };
    }

    return { results: team };
  }

  @RequireAuth()
  @Mutation(() => WorshipTeamResponse)
  async createWorshipTeam(
    @Arg("options", () => WorshipTeamInput) options: WorshipTeamInput,
    @Ctx() { em, request }: MyContext
  ): Promise<WorshipTeamResponse> {
    const req = request as any;

    const user = await em.findOne(User, { _id: req.userId });

    if (!user) {
      return {
        errors: [
          {
            field: "User",
            message: "No user found, try to log in.",
          },
        ],
      };
    }

    const team = em.create(WorshipTeam, {
      name: options.name,
      description: options.description,
      author: user,
    });

    try {
      await em.persistAndFlush(team);
    } catch (err) {
      console.error("Error creating worship team:", err);
      return {
        errors: [
          {
            field: "WorshipTeam",
            message: "Failed to create worship team",
          },
        ],
      };
    }

    return { results: team };
  }

  @RequireAuth()
  @Mutation(() => WorshipTeamResponse)
  async updateWorshipTeam(
    @Arg("id") id: string,
    @Arg("options", () => WorshipTeamInput) options: WorshipTeamInput,
    @Ctx() { em, request }: MyContext
  ): Promise<WorshipTeamResponse> {
    const req = request as any;

    const team = await em.findOne(WorshipTeam, { _id: new ObjectId(id) }, { populate: ["author"] });

    if (!team) {
      return {
        errors: [
          {
            field: "WorshipTeam",
            message: "Team not found",
          },
        ],
      };
    }

    if (!team.author._id.equals(req.userId)) {
      return {
        errors: [
          {
            field: "WorshipTeam",
            message: "Only the team owner can update this team",
          },
        ],
      };
    }

    try {
      em.assign(
        team,
        omitUndefined({
          name: options.name,
          description: options.description,
        })
      );
      await em.persistAndFlush(team);
      await em.populate(team, ["author", "members", "members.user"]);
    } catch (err) {
      console.error("Error updating worship team:", err);
      return {
        errors: [
          {
            field: "WorshipTeam",
            message: "Failed to update worship team",
          },
        ],
      };
    }

    return { results: team };
  }

  @RequireAuth()
  @Mutation(() => WorshipTeamResponse)
  async deleteWorshipTeam(
    @Arg("id") id: string,
    @Ctx() { em, request }: MyContext
  ): Promise<WorshipTeamResponse> {
    const req = request as any;

    const team = await em.findOne(WorshipTeam, { _id: new ObjectId(id) }, { populate: ["author"] });

    if (!team) {
      return {
        errors: [
          {
            field: "WorshipTeam",
            message: "Team not found",
          },
        ],
      };
    }

    if (!team.author._id.equals(req.userId)) {
      return {
        errors: [
          {
            field: "WorshipTeam",
            message: "Only the team owner can delete this team",
          },
        ],
      };
    }

    try {
      await em.removeAndFlush(team);
    } catch (err) {
      console.error("Error deleting worship team:", err);
      return {
        errors: [
          {
            field: "WorshipTeam",
            message: "Failed to delete worship team",
          },
        ],
      };
    }

    return { results: team };
  }
}
