import {
  Resolver,
  Query,
  Arg,
  Ctx,
  Mutation,
  Field,
  ObjectType,
} from "type-graphql";
import { Song, SongInput } from "../../../entities/Worship/Song";
import { MyContext } from "../../../types";
import { ObjectId } from "@mikro-orm/mongodb";
import { User } from "../../../entities/User";
import { FieldError } from "../../../entities/Errors/FieldError";
import { ValidateUser } from "../../../middlewares/userAuth";

@ObjectType()
class SongResponse {
  @Field(() => Song, { nullable: true })
  results?: Song;

  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];
}

@ObjectType()
class SongsResponse {
  @Field(() => [Song], { nullable: true })
  results?: Song[];

  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];
}

@Resolver()
export class SongResolver {
  @ValidateUser()
  @Query(() => SongsResponse)
  async getSongs(
    @Ctx() { em, request }: MyContext
  ): Promise<SongsResponse> {
    const req = request as any;

    if (!req.userId) {
      return {
        errors: [{ field: "User", message: "User cannot be found. Please login first." }],
      };
    }

    const songs = await em.find(
      Song,
      { author: req.userId },
      { orderBy: { title: "ASC" } }
    );

    for (const song of songs) {
      await em.populate(song, ["author"]);
    }

    return { results: songs };
  }

  @ValidateUser()
  @Query(() => SongResponse)
  async getSong(
    @Arg("id") id: string,
    @Ctx() { em, request }: MyContext
  ): Promise<SongResponse> {
    const req = request as any;

    if (!req.userId) {
      return {
        errors: [{ field: "User", message: "User cannot be found. Please login first." }],
      };
    }

    const song = await em.findOne(Song, { _id: new ObjectId(id) });

    if (!song) {
      return {
        errors: [{ field: "Song", message: "Song not found" }],
      };
    }

    await em.populate(song, ["author"]);

    return { results: song };
  }

  @ValidateUser()
  @Query(() => SongsResponse)
  async searchSongs(
    @Arg("searchTerm") searchTerm: string,
    @Ctx() { em, request }: MyContext
  ): Promise<SongsResponse> {
    const req = request as any;

    if (!req.userId) {
      return {
        errors: [{ field: "User", message: "User cannot be found. Please login first." }],
      };
    }

    const regex = new RegExp(searchTerm, "i");
    const songs = await em.find(
      Song,
      {
        author: req.userId,
        $or: [
          { title: regex },
          { artist: regex },
        ],
      } as any,
      { orderBy: { title: "ASC" } }
    );

    return { results: songs };
  }

  @ValidateUser()
  @Mutation(() => SongResponse)
  async createSong(
    @Arg("options", () => SongInput) options: SongInput,
    @Ctx() { em, request }: MyContext
  ): Promise<SongResponse> {
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

    const song = em.create(Song, {
      ...options,
      author: user,
    });

    try {
      await em.persistAndFlush(song);
    } catch (err) {
      console.error("Error creating song:", err);
      return {
        errors: [{ field: "Song", message: "Failed to create song" }],
      };
    }

    return { results: song };
  }

  @ValidateUser()
  @Mutation(() => SongResponse)
  async updateSong(
    @Arg("id") id: string,
    @Arg("options", () => SongInput) options: SongInput,
    @Ctx() { em, request }: MyContext
  ): Promise<SongResponse> {
    const req = request as any;

    if (!req.userId) {
      return {
        errors: [{ field: "User", message: "User cannot be found. Please login first." }],
      };
    }

    const song = await em.findOne(Song, { _id: new ObjectId(id) });

    if (!song) {
      return {
        errors: [{ field: "Song", message: "Song not found" }],
      };
    }

    try {
      em.assign(song, options);
      await em.persistAndFlush(song);
      await em.populate(song, ["author"]);
    } catch (err) {
      console.error("Error updating song:", err);
      return {
        errors: [{ field: "Song", message: "Failed to update song" }],
      };
    }

    return { results: song };
  }

  @ValidateUser()
  @Mutation(() => SongResponse)
  async deleteSong(
    @Arg("id") id: string,
    @Ctx() { em, request }: MyContext
  ): Promise<SongResponse> {
    const req = request as any;

    if (!req.userId) {
      return {
        errors: [{ field: "User", message: "User cannot be found. Please login first." }],
      };
    }

    const song = await em.findOne(Song, { _id: new ObjectId(id) });

    if (!song) {
      return {
        errors: [{ field: "Song", message: "Song not found" }],
      };
    }

    try {
      await em.removeAndFlush(song);
    } catch (err) {
      console.error("Error deleting song:", err);
      return {
        errors: [{ field: "Song", message: "Failed to delete song" }],
      };
    }

    return { results: song };
  }
}
