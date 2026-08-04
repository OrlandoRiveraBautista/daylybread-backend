import {
  Resolver,
  Query,
  Arg,
  Ctx,
  Mutation,
  Field,
  ObjectType,
} from "type-graphql";
import { Setlist, SetlistInput } from "../../../entities/Worship/Setlist";
import { SetlistItem, SetlistItemInput } from "../../../entities/Worship/SetlistItem";
import { WorshipService } from "../../../entities/Worship/WorshipService";
import { WorshipTeam } from "../../../entities/Worship/WorshipTeam";
import { Song } from "../../../entities/Worship/Song";
import { MyContext } from "../../../types";
import { ObjectId } from "@mikro-orm/mongodb";
import { User } from "../../../entities/User";
import { FieldError } from "../../../entities/Errors/FieldError";
import { RequireAuth } from "../../../middlewares/userAuth";
import { omitUndefined } from "../../../utility";
import { TeamMember } from "../../../entities/Worship/TeamMember";
import { EntityManager } from "@mikro-orm/core";

async function canManageSetlist(
  em: EntityManager,
  setlist: Setlist,
  userId: any
): Promise<boolean> {
  await em.populate(setlist, ["author", "service", "service.author", "service.team"]);
  if (setlist.author?._id?.equals?.(userId) || setlist.author?._id?.toString() === userId?.toString()) {
    return true;
  }
  if (
    setlist.service?.author?._id?.equals?.(userId) ||
    setlist.service?.author?._id?.toString() === userId?.toString()
  ) {
    return true;
  }
  const teamId = setlist.service?.team?._id;
  if (!teamId) return false;

  const team = await em.findOne(
    WorshipTeam,
    { _id: teamId },
    { populate: ["author"] }
  );
  if (
    team?.author?._id?.equals?.(userId) ||
    team?.author?._id?.toString() === userId?.toString()
  ) {
    return true;
  }

  const membership = await em.findOne(TeamMember, {
    team: teamId,
    user: userId,
  });
  return !!membership;
}

@ObjectType()
class SetlistResponse {
  @Field(() => Setlist, { nullable: true })
  results?: Setlist;

  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];
}

@ObjectType()
class SetlistItemResponse {
  @Field(() => SetlistItem, { nullable: true })
  results?: SetlistItem;

  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];
}

@Resolver()
export class SetlistResolver {
  @RequireAuth()
  @Query(() => SetlistResponse)
  async getSetlist(
    @Arg("serviceId") serviceId: string,
    @Ctx() { em }: MyContext
  ): Promise<SetlistResponse> {

    const setlist = await em.findOne(
      Setlist,
      { service: new ObjectId(serviceId) },
      { populate: ["items", "items.song", "service", "author"] }
    );

    if (!setlist) {
      return {
        errors: [{ field: "Setlist", message: "Setlist not found for this service" }],
      };
    }

    return { results: setlist };
  }

  @RequireAuth()
  @Mutation(() => SetlistResponse)
  async createSetlist(
    @Arg("options", () => SetlistInput) options: SetlistInput,
    @Ctx() { em, request }: MyContext
  ): Promise<SetlistResponse> {
    const req = request as any;

    const user = await em.findOne(User, { _id: req.userId });
    if (!user) {
      return {
        errors: [{ field: "User", message: "No user found, try to log in." }],
      };
    }

    const service = await em.findOne(
      WorshipService,
      { _id: new ObjectId(options.serviceId) },
      { populate: ["author", "team"] }
    );
    if (!service) {
      return {
        errors: [{ field: "WorshipService", message: "Service not found" }],
      };
    }

    const team = await em.findOne(
      WorshipTeam,
      { _id: service.team._id },
      { populate: ["author"] }
    );
    const isServiceAuthor =
      service.author._id.equals(req.userId) ||
      service.author._id.toString() === req.userId.toString();
    const isTeamOwner =
      team?.author?._id?.equals?.(req.userId) ||
      team?.author?._id?.toString() === req.userId.toString();
    const isMember = await em.findOne(TeamMember, {
      team: service.team._id,
      user: req.userId,
    });
    if (!isServiceAuthor && !isTeamOwner && !isMember) {
      return {
        errors: [
          {
            field: "Setlist",
            message: "You do not have permission to create a setlist for this service",
          },
        ],
      };
    }

    // Check if setlist already exists for this service
    const existing = await em.findOne(Setlist, { service: new ObjectId(options.serviceId) });
    if (existing) {
      return {
        errors: [{ field: "Setlist", message: "A setlist already exists for this service" }],
      };
    }

    const setlist = em.create(Setlist, {
      name: options.name,
      service,
      author: user,
    });

    try {
      await em.persistAndFlush(setlist);
      await em.populate(setlist, ["service", "author"]);
    } catch (err) {
      console.error("Error creating setlist:", err);
      return {
        errors: [{ field: "Setlist", message: "Failed to create setlist" }],
      };
    }

    return { results: setlist };
  }

  @RequireAuth()
  @Mutation(() => SetlistItemResponse)
  async addSetlistItem(
    @Arg("setlistId") setlistId: string,
    @Arg("options", () => SetlistItemInput) options: SetlistItemInput,
    @Ctx() { em, request }: MyContext
  ): Promise<SetlistItemResponse> {
    const req = request as any;
    const setlist = await em.findOne(Setlist, { _id: new ObjectId(setlistId) });
    if (!setlist) {
      return {
        errors: [{ field: "Setlist", message: "Setlist not found" }],
      };
    }
    if (!(await canManageSetlist(em, setlist, req.userId))) {
      return {
        errors: [
          {
            field: "Setlist",
            message: "You do not have permission to modify this setlist",
          },
        ],
      };
    }

    const song = await em.findOne(Song, { _id: new ObjectId(options.songId) });
    if (!song) {
      return {
        errors: [{ field: "Song", message: "Song not found" }],
      };
    }

    const item = em.create(SetlistItem, {
      setlist,
      song,
      order: options.order,
      key: options.key || song.defaultKey,
      bpm: options.bpm || song.bpm,
      notes: options.notes,
    });

    try {
      await em.persistAndFlush(item);
      await em.populate(item, ["song", "setlist"]);
    } catch (err) {
      console.error("Error adding setlist item:", err);
      return {
        errors: [{ field: "SetlistItem", message: "Failed to add item to setlist" }],
      };
    }

    return { results: item };
  }

  @RequireAuth()
  @Mutation(() => SetlistItemResponse)
  async updateSetlistItem(
    @Arg("id") id: string,
    @Arg("options", () => SetlistItemInput) options: SetlistItemInput,
    @Ctx() { em, request }: MyContext
  ): Promise<SetlistItemResponse> {
    const req = request as any;
    const item = await em.findOne(
      SetlistItem,
      { _id: new ObjectId(id) },
      { populate: ["setlist"] }
    );
    if (!item) {
      return {
        errors: [{ field: "SetlistItem", message: "Setlist item not found" }],
      };
    }
    if (!(await canManageSetlist(em, item.setlist, req.userId))) {
      return {
        errors: [
          {
            field: "Setlist",
            message: "You do not have permission to modify this setlist",
          },
        ],
      };
    }

    const song = await em.findOne(Song, { _id: new ObjectId(options.songId) });
    if (!song) {
      return {
        errors: [{ field: "Song", message: "Song not found" }],
      };
    }

    try {
      em.assign(
        item,
        omitUndefined({
          song,
          order: options.order,
          key: options.key,
          bpm: options.bpm,
          notes: options.notes,
        })
      );
      await em.persistAndFlush(item);
      await em.populate(item, ["song", "setlist"]);
    } catch (err) {
      console.error("Error updating setlist item:", err);
      return {
        errors: [{ field: "SetlistItem", message: "Failed to update setlist item" }],
      };
    }

    return { results: item };
  }

  @RequireAuth()
  @Mutation(() => SetlistItemResponse)
  async removeSetlistItem(
    @Arg("id") id: string,
    @Ctx() { em, request }: MyContext
  ): Promise<SetlistItemResponse> {
    const req = request as any;
    const item = await em.findOne(
      SetlistItem,
      { _id: new ObjectId(id) },
      { populate: ["setlist"] }
    );
    if (!item) {
      return {
        errors: [{ field: "SetlistItem", message: "Setlist item not found" }],
      };
    }
    if (!(await canManageSetlist(em, item.setlist, req.userId))) {
      return {
        errors: [
          {
            field: "Setlist",
            message: "You do not have permission to modify this setlist",
          },
        ],
      };
    }

    try {
      await em.removeAndFlush(item);
    } catch (err) {
      console.error("Error removing setlist item:", err);
      return {
        errors: [{ field: "SetlistItem", message: "Failed to remove setlist item" }],
      };
    }

    return { results: item };
  }

  @RequireAuth()
  @Mutation(() => SetlistResponse)
  async reorderSetlistItems(
    @Arg("setlistId") setlistId: string,
    @Arg("itemIds", () => [String]) itemIds: string[],
    @Ctx() { em, request }: MyContext
  ): Promise<SetlistResponse> {
    const req = request as any;
    const setlist = await em.findOne(
      Setlist,
      { _id: new ObjectId(setlistId) },
      { populate: ["items", "items.song"] }
    );

    if (!setlist) {
      return {
        errors: [{ field: "Setlist", message: "Setlist not found" }],
      };
    }
    if (!(await canManageSetlist(em, setlist, req.userId))) {
      return {
        errors: [
          {
            field: "Setlist",
            message: "You do not have permission to modify this setlist",
          },
        ],
      };
    }

    try {
      for (let i = 0; i < itemIds.length; i++) {
        const item = await em.findOne(SetlistItem, { _id: new ObjectId(itemIds[i]) });
        if (item) {
          item.order = i + 1;
        }
      }
      await em.flush();
      await em.populate(setlist, ["items", "items.song", "service", "author"]);
    } catch (err) {
      console.error("Error reordering setlist:", err);
      return {
        errors: [{ field: "Setlist", message: "Failed to reorder setlist" }],
      };
    }

    return { results: setlist };
  }

  @RequireAuth()
  @Mutation(() => SetlistResponse)
  async deleteSetlist(
    @Arg("id") id: string,
    @Ctx() { em, request }: MyContext
  ): Promise<SetlistResponse> {
    const req = request as any;
    const setlist = await em.findOne(Setlist, { _id: new ObjectId(id) });
    if (!setlist) {
      return {
        errors: [{ field: "Setlist", message: "Setlist not found" }],
      };
    }
    if (!(await canManageSetlist(em, setlist, req.userId))) {
      return {
        errors: [
          {
            field: "Setlist",
            message: "You do not have permission to modify this setlist",
          },
        ],
      };
    }

    try {
      // Remove all items first
      const items = await em.find(SetlistItem, { setlist: new ObjectId(id) });
      for (const item of items) {
        await em.removeAndFlush(item);
      }
      await em.removeAndFlush(setlist);
    } catch (err) {
      console.error("Error deleting setlist:", err);
      return {
        errors: [{ field: "Setlist", message: "Failed to delete setlist" }],
      };
    }

    return { results: setlist };
  }
}
