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
import { Song } from "../../../entities/Worship/Song";
import { MyContext } from "../../../types";
import { ObjectId } from "@mikro-orm/mongodb";
import { User } from "../../../entities/User";
import { FieldError } from "../../../entities/Errors/FieldError";
import { ValidateUser } from "../../../middlewares/userAuth";

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
  @ValidateUser()
  @Query(() => SetlistResponse)
  async getSetlist(
    @Arg("serviceId") serviceId: string,
    @Ctx() { em, request }: MyContext
  ): Promise<SetlistResponse> {
    const req = request as any;

    if (!req.userId) {
      return {
        errors: [{ field: "User", message: "User cannot be found. Please login first." }],
      };
    }

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

  @ValidateUser()
  @Mutation(() => SetlistResponse)
  async createSetlist(
    @Arg("options", () => SetlistInput) options: SetlistInput,
    @Ctx() { em, request }: MyContext
  ): Promise<SetlistResponse> {
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

    const service = await em.findOne(WorshipService, { _id: new ObjectId(options.serviceId) });
    if (!service) {
      return {
        errors: [{ field: "WorshipService", message: "Service not found" }],
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

  @ValidateUser()
  @Mutation(() => SetlistItemResponse)
  async addSetlistItem(
    @Arg("setlistId") setlistId: string,
    @Arg("options", () => SetlistItemInput) options: SetlistItemInput,
    @Ctx() { em, request }: MyContext
  ): Promise<SetlistItemResponse> {
    const req = request as any;

    if (!req.userId) {
      return {
        errors: [{ field: "User", message: "User cannot be found. Please login first." }],
      };
    }

    const setlist = await em.findOne(Setlist, { _id: new ObjectId(setlistId) });
    if (!setlist) {
      return {
        errors: [{ field: "Setlist", message: "Setlist not found" }],
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

  @ValidateUser()
  @Mutation(() => SetlistItemResponse)
  async updateSetlistItem(
    @Arg("id") id: string,
    @Arg("options", () => SetlistItemInput) options: SetlistItemInput,
    @Ctx() { em, request }: MyContext
  ): Promise<SetlistItemResponse> {
    const req = request as any;

    if (!req.userId) {
      return {
        errors: [{ field: "User", message: "User cannot be found. Please login first." }],
      };
    }

    const item = await em.findOne(SetlistItem, { _id: new ObjectId(id) });
    if (!item) {
      return {
        errors: [{ field: "SetlistItem", message: "Setlist item not found" }],
      };
    }

    const song = await em.findOne(Song, { _id: new ObjectId(options.songId) });
    if (!song) {
      return {
        errors: [{ field: "Song", message: "Song not found" }],
      };
    }

    try {
      em.assign(item, {
        song,
        order: options.order,
        key: options.key,
        bpm: options.bpm,
        notes: options.notes,
      });
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

  @ValidateUser()
  @Mutation(() => SetlistItemResponse)
  async removeSetlistItem(
    @Arg("id") id: string,
    @Ctx() { em, request }: MyContext
  ): Promise<SetlistItemResponse> {
    const req = request as any;

    if (!req.userId) {
      return {
        errors: [{ field: "User", message: "User cannot be found. Please login first." }],
      };
    }

    const item = await em.findOne(SetlistItem, { _id: new ObjectId(id) });
    if (!item) {
      return {
        errors: [{ field: "SetlistItem", message: "Setlist item not found" }],
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

  @ValidateUser()
  @Mutation(() => SetlistResponse)
  async reorderSetlistItems(
    @Arg("setlistId") setlistId: string,
    @Arg("itemIds", () => [String]) itemIds: string[],
    @Ctx() { em, request }: MyContext
  ): Promise<SetlistResponse> {
    const req = request as any;

    if (!req.userId) {
      return {
        errors: [{ field: "User", message: "User cannot be found. Please login first." }],
      };
    }

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

  @ValidateUser()
  @Mutation(() => SetlistResponse)
  async deleteSetlist(
    @Arg("id") id: string,
    @Ctx() { em, request }: MyContext
  ): Promise<SetlistResponse> {
    const req = request as any;

    if (!req.userId) {
      return {
        errors: [{ field: "User", message: "User cannot be found. Please login first." }],
      };
    }

    const setlist = await em.findOne(Setlist, { _id: new ObjectId(id) });
    if (!setlist) {
      return {
        errors: [{ field: "Setlist", message: "Setlist not found" }],
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
