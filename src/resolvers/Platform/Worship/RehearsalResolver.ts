import {
  Resolver,
  Query,
  Arg,
  Ctx,
  Mutation,
  Field,
  ObjectType,
} from "type-graphql";
import { Rehearsal, RehearsalInput } from "../../../entities/Worship/Rehearsal";
import { WorshipTeam } from "../../../entities/Worship/WorshipTeam";
import { WorshipService } from "../../../entities/Worship/WorshipService";
import { MyContext } from "../../../types";
import { ObjectId } from "@mikro-orm/mongodb";
import { User } from "../../../entities/User";
import { FieldError } from "../../../entities/Errors/FieldError";
import { ValidateUser } from "../../../middlewares/userAuth";

@ObjectType()
class RehearsalResponse {
  @Field(() => Rehearsal, { nullable: true })
  results?: Rehearsal;

  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];
}

@ObjectType()
class RehearsalsResponse {
  @Field(() => [Rehearsal], { nullable: true })
  results?: Rehearsal[];

  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];
}

@Resolver()
export class RehearsalResolver {
  @ValidateUser()
  @Query(() => RehearsalsResponse)
  async getRehearsals(
    @Arg("teamId", { nullable: true }) teamId: string,
    @Arg("serviceId", { nullable: true }) serviceId: string,
    @Ctx() { em, request }: MyContext
  ): Promise<RehearsalsResponse> {
    const req = request as any;

    if (!req.userId) {
      return {
        errors: [{ field: "User", message: "User cannot be found. Please login first." }],
      };
    }

    const filter: any = { author: req.userId };
    if (teamId) {
      filter.team = new ObjectId(teamId);
    }
    if (serviceId) {
      filter.service = new ObjectId(serviceId);
    }

    const rehearsals = await em.find(
      Rehearsal,
      filter,
      { orderBy: { date: "DESC" }, populate: ["team", "author", "service"] }
    );

    return { results: rehearsals };
  }

  @ValidateUser()
  @Query(() => RehearsalResponse)
  async getRehearsal(
    @Arg("id") id: string,
    @Ctx() { em, request }: MyContext
  ): Promise<RehearsalResponse> {
    const req = request as any;

    if (!req.userId) {
      return {
        errors: [{ field: "User", message: "User cannot be found. Please login first." }],
      };
    }

    const rehearsal = await em.findOne(
      Rehearsal,
      { _id: new ObjectId(id) },
      { populate: ["team", "author", "service"] }
    );

    if (!rehearsal) {
      return {
        errors: [{ field: "Rehearsal", message: "Rehearsal not found" }],
      };
    }

    return { results: rehearsal };
  }

  @ValidateUser()
  @Mutation(() => RehearsalResponse)
  async createRehearsal(
    @Arg("options", () => RehearsalInput) options: RehearsalInput,
    @Ctx() { em, request }: MyContext
  ): Promise<RehearsalResponse> {
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

    const team = await em.findOne(WorshipTeam, { _id: new ObjectId(options.teamId) });
    if (!team) {
      return {
        errors: [{ field: "WorshipTeam", message: "Team not found" }],
      };
    }

    const service = await em.findOne(WorshipService, { _id: new ObjectId(options.serviceId) });
    if (!service) {
      return {
        errors: [{ field: "WorshipService", message: "Service not found" }],
      };
    }

    const rehearsal = em.create(Rehearsal, {
      team,
      service,
      author: user,
      date: new Date(options.date),
      notes: options.notes,
      songIds: options.songIds,
    });

    try {
      await em.persistAndFlush(rehearsal);
      await em.populate(rehearsal, ["team", "author", "service"]);
    } catch (err) {
      console.error("Error creating rehearsal:", err);
      return {
        errors: [{ field: "Rehearsal", message: "Failed to create rehearsal" }],
      };
    }

    return { results: rehearsal };
  }

  @ValidateUser()
  @Mutation(() => RehearsalResponse)
  async updateRehearsal(
    @Arg("id") id: string,
    @Arg("options", () => RehearsalInput) options: RehearsalInput,
    @Ctx() { em, request }: MyContext
  ): Promise<RehearsalResponse> {
    const req = request as any;

    if (!req.userId) {
      return {
        errors: [{ field: "User", message: "User cannot be found. Please login first." }],
      };
    }

    const rehearsal = await em.findOne(Rehearsal, { _id: new ObjectId(id) });
    if (!rehearsal) {
      return {
        errors: [{ field: "Rehearsal", message: "Rehearsal not found" }],
      };
    }

    const team = await em.findOne(WorshipTeam, { _id: new ObjectId(options.teamId) });
    if (!team) {
      return {
        errors: [{ field: "WorshipTeam", message: "Team not found" }],
      };
    }

    const service = await em.findOne(WorshipService, { _id: new ObjectId(options.serviceId) });
    if (!service) {
      return {
        errors: [{ field: "WorshipService", message: "Service not found" }],
      };
    }

    try {
      em.assign(rehearsal, {
        team,
        service,
        date: new Date(options.date),
        notes: options.notes,
        songIds: options.songIds,
      });
      await em.persistAndFlush(rehearsal);
      await em.populate(rehearsal, ["team", "author", "service"]);
    } catch (err) {
      console.error("Error updating rehearsal:", err);
      return {
        errors: [{ field: "Rehearsal", message: "Failed to update rehearsal" }],
      };
    }

    return { results: rehearsal };
  }

  @ValidateUser()
  @Mutation(() => RehearsalResponse)
  async deleteRehearsal(
    @Arg("id") id: string,
    @Ctx() { em, request }: MyContext
  ): Promise<RehearsalResponse> {
    const req = request as any;

    if (!req.userId) {
      return {
        errors: [{ field: "User", message: "User cannot be found. Please login first." }],
      };
    }

    const rehearsal = await em.findOne(Rehearsal, { _id: new ObjectId(id) });
    if (!rehearsal) {
      return {
        errors: [{ field: "Rehearsal", message: "Rehearsal not found" }],
      };
    }

    try {
      await em.removeAndFlush(rehearsal);
    } catch (err) {
      console.error("Error deleting rehearsal:", err);
      return {
        errors: [{ field: "Rehearsal", message: "Failed to delete rehearsal" }],
      };
    }

    return { results: rehearsal };
  }
}
