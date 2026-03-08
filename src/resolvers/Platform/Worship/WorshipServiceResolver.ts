import {
  Resolver,
  Query,
  Arg,
  Ctx,
  Mutation,
  Field,
  ObjectType,
} from "type-graphql";
import { WorshipService, WorshipServiceInput } from "../../../entities/Worship/WorshipService";
import { WorshipTeam } from "../../../entities/Worship/WorshipTeam";
import { TeamMember } from "../../../entities/Worship/TeamMember";
import { MyContext } from "../../../types";
import { ObjectId } from "@mikro-orm/mongodb";
import { User } from "../../../entities/User";
import { FieldError } from "../../../entities/Errors/FieldError";
import { ValidateUser } from "../../../middlewares/userAuth";

@ObjectType()
class WorshipServiceResponse {
  @Field(() => WorshipService, { nullable: true })
  results?: WorshipService;

  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];
}

@ObjectType()
class WorshipServicesResponse {
  @Field(() => [WorshipService], { nullable: true })
  results?: WorshipService[];

  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];
}

@Resolver()
export class WorshipServiceResolver {
  @ValidateUser()
  @Query(() => WorshipServicesResponse)
  async getWorshipServices(
    @Arg("teamId", { nullable: true }) teamId: string,
    @Ctx() { em, request }: MyContext
  ): Promise<WorshipServicesResponse> {
    const req = request as any;

    if (!req.userId) {
      return {
        errors: [{ field: "User", message: "User cannot be found. Please login first." }],
      };
    }

    if (teamId) {
      // Verify user has access to this team
      const team = await em.findOne(WorshipTeam, { _id: new ObjectId(teamId) }, { populate: ["author"] });
      if (!team) {
        return { errors: [{ field: "WorshipTeam", message: "Team not found" }] };
      }

      const isAuthor = team.author._id.equals(req.userId);
      const isMember = await em.findOne(TeamMember, { team: new ObjectId(teamId), user: req.userId });
      if (!isAuthor && !isMember) {
        return { errors: [{ field: "WorshipTeam", message: "You do not have access to this team" }] };
      }

      const services = await em.find(
        WorshipService,
        { team: new ObjectId(teamId) },
        {
          orderBy: { date: "DESC" },
          populate: ["team", "author", "assignments", "assignments.member", "assignments.member.user", "setlist"],
        }
      );
      return { results: services };
    }

    // No teamId filter — return services for all teams user owns or is a member of
    const memberships = await em.find(TeamMember, { user: req.userId });
    const memberTeamIds = memberships.map((m) => m.team._id);

    const services = await em.find(
      WorshipService,
      {
        $or: [
          { author: req.userId },
          { team: { $in: memberTeamIds } },
        ],
      },
      {
        orderBy: { date: "DESC" },
        populate: ["team", "author", "assignments", "assignments.member", "assignments.member.user", "setlist"],
      }
    );

    return { results: services };
  }

  @ValidateUser()
  @Query(() => WorshipServiceResponse)
  async getWorshipService(
    @Arg("id") id: string,
    @Ctx() { em, request }: MyContext
  ): Promise<WorshipServiceResponse> {
    const req = request as any;

    if (!req.userId) {
      return {
        errors: [{ field: "User", message: "User cannot be found. Please login first." }],
      };
    }

    const service = await em.findOne(
      WorshipService,
      { _id: new ObjectId(id) },
      {
        populate: [
          "team",
          "author",
          "assignments",
          "assignments.member",
          "assignments.member.user",
          "setlist",
          "setlist.items",
          "setlist.items.song",
        ],
      }
    );

    if (!service) {
      return {
        errors: [{ field: "WorshipService", message: "Service not found" }],
      };
    }

    // Verify user has access to the team this service belongs to
    const isAuthor = service.author._id.equals(req.userId);
    const isMember = await em.findOne(TeamMember, { team: service.team._id, user: req.userId });
    if (!isAuthor && !isMember) {
      return {
        errors: [{ field: "WorshipService", message: "You do not have access to this service" }],
      };
    }

    return { results: service };
  }

  @ValidateUser()
  @Mutation(() => WorshipServiceResponse)
  async createWorshipService(
    @Arg("options", () => WorshipServiceInput) options: WorshipServiceInput,
    @Ctx() { em, request }: MyContext
  ): Promise<WorshipServiceResponse> {
    const req = request as any;

    if (!req.userId) {
      return {
        errors: [{ field: "User", message: "User cannot be found. Please login first." }],
      };
    }

    const user = await em.findOne(User, { _id: req.userId });
    if (!user) {
      return {
        errors: [{ field: "User", message: "No user found, try to log in." }],
      };
    }

    const team = await em.findOne(WorshipTeam, { _id: new ObjectId(options.teamId) }, { populate: ["author"] });
    if (!team) {
      return {
        errors: [{ field: "WorshipTeam", message: "Team not found" }],
      };
    }

    // Verify user is team author or member
    const isTeamAuthor = team.author._id.equals(req.userId);
    const isTeamMember = await em.findOne(TeamMember, { team: new ObjectId(options.teamId), user: req.userId });
    if (!isTeamAuthor && !isTeamMember) {
      return {
        errors: [{ field: "WorshipTeam", message: "You do not have access to this team" }],
      };
    }

    const service = em.create(WorshipService, {
      name: options.name,
      date: new Date(options.date),
      team,
      author: user,
      notes: options.notes,
      status: options.status,
    });

    try {
      await em.persistAndFlush(service);
      await em.populate(service, ["team", "author"]);
    } catch (err) {
      console.error("Error creating worship service:", err);
      return {
        errors: [{ field: "WorshipService", message: "Failed to create worship service" }],
      };
    }

    return { results: service };
  }

  @ValidateUser()
  @Mutation(() => WorshipServiceResponse)
  async updateWorshipService(
    @Arg("id") id: string,
    @Arg("options", () => WorshipServiceInput) options: WorshipServiceInput,
    @Ctx() { em, request }: MyContext
  ): Promise<WorshipServiceResponse> {
    const req = request as any;

    if (!req.userId) {
      return {
        errors: [{ field: "User", message: "User cannot be found. Please login first." }],
      };
    }

    const service = await em.findOne(WorshipService, { _id: new ObjectId(id) }, { populate: ["author", "team"] });
    if (!service) {
      return {
        errors: [{ field: "WorshipService", message: "Service not found" }],
      };
    }

    // Only the service author or team owner can update
    const serviceTeam = await em.findOne(WorshipTeam, { _id: service.team._id }, { populate: ["author"] });
    const isServiceAuthor = service.author._id.equals(req.userId);
    const isTeamOwner = serviceTeam?.author._id.equals(req.userId);
    if (!isServiceAuthor && !isTeamOwner) {
      return {
        errors: [{ field: "WorshipService", message: "Only the service creator or team owner can update this service" }],
      };
    }

    const team = await em.findOne(WorshipTeam, { _id: new ObjectId(options.teamId) });
    if (!team) {
      return {
        errors: [{ field: "WorshipTeam", message: "Team not found" }],
      };
    }

    try {
      em.assign(service, {
        name: options.name,
        date: new Date(options.date),
        team,
        notes: options.notes,
        status: options.status || service.status,
      });
      await em.persistAndFlush(service);
      await em.populate(service, ["team", "author", "assignments", "assignments.member", "assignments.member.user"]);
    } catch (err) {
      console.error("Error updating worship service:", err);
      return {
        errors: [{ field: "WorshipService", message: "Failed to update worship service" }],
      };
    }

    return { results: service };
  }

  @ValidateUser()
  @Mutation(() => WorshipServiceResponse)
  async deleteWorshipService(
    @Arg("id") id: string,
    @Ctx() { em, request }: MyContext
  ): Promise<WorshipServiceResponse> {
    const req = request as any;

    if (!req.userId) {
      return {
        errors: [{ field: "User", message: "User cannot be found. Please login first." }],
      };
    }

    const service = await em.findOne(WorshipService, { _id: new ObjectId(id) }, { populate: ["author", "team"] });
    if (!service) {
      return {
        errors: [{ field: "WorshipService", message: "Service not found" }],
      };
    }

    // Only the service author or team owner can delete
    const delTeam = await em.findOne(WorshipTeam, { _id: service.team._id }, { populate: ["author"] });
    const isDelAuthor = service.author._id.equals(req.userId);
    const isDelTeamOwner = delTeam?.author._id.equals(req.userId);
    if (!isDelAuthor && !isDelTeamOwner) {
      return {
        errors: [{ field: "WorshipService", message: "Only the service creator or team owner can delete this service" }],
      };
    }

    try {
      await em.removeAndFlush(service);
    } catch (err) {
      console.error("Error deleting worship service:", err);
      return {
        errors: [{ field: "WorshipService", message: "Failed to delete worship service" }],
      };
    }

    return { results: service };
  }
}
