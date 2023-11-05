import {
  Arg,
  Ctx,
  Field,
  InputType,
  Mutation,
  Query,
  Resolver,
} from "type-graphql";
import { ValidateUser } from "../middlewares/userAuth";
import {
  BookmarkResponse,
  GetBookmarkResponse,
  MyContext,
  UserResponse,
} from "../types";
import { User } from "../entities/User";
import { Bookmark } from "../entities/Bookmark";
import { Verse } from "../entities/Bible/Verse";
import { ObjectId } from "@mikro-orm/mongodb";

/* Interfaces */

@InputType()
class BookmarkOptions {
  @Field(() => [String], { nullable: true })
  verses?: string[] | undefined; // will be sent as stringified json

  @Field(() => String, { nullable: true })
  note?: string | undefined;
}

@Resolver()
export class BookmarkResolver {
  /* Route to create a new bookmark */
  @ValidateUser()
  @Mutation(() => BookmarkResponse)
  async createBookmark(
    @Arg("options", () => BookmarkOptions) options: BookmarkOptions,
    @Ctx() { em, request }: MyContext
  ): Promise<BookmarkResponse> {
    // since I wil be using a non explicit value from request (userId)
    // I will declare a local req as any
    const req = request as any;

    // check to see if the header was set from the middleware
    if (!req.userId) {
      const error: UserResponse = {
        errors: [
          {
            field: "User",
            message: "User cannot be found. Please login first.",
          },
        ],
      };

      return error;
    }

    // find the user
    const user = await em.findOne(User, { _id: req.userId });

    // throw error if user is not found
    if (!user) {
      const error: UserResponse = {
        errors: [
          {
            message: `No user found, try to log in.`,
          },
        ],
      };
      return error;
    }

    // find all verse
    const chosenVerses = await em.find(Verse, {
      $and: [{ bibleId: { $in: options.verses } }],
    });

    // create new bookmark object
    const newBookmark = em.create(Bookmark, {
      author: user,
      note: options.note,
    });

    // loop through the chosen verses
    Object.entries(chosenVerses).forEach(([_, verse]) => {
      try {
        // try to add the refernce of the verses
        newBookmark.verses.add(em.getReference(Verse, verse._id));
      } catch (err) {
        console.log(err);
        throw err;
      }
    });

    try {
      await em.persistAndFlush([newBookmark, ...chosenVerses]);
    } catch (err) {
      throw err;
    }

    return { results: newBookmark };
  }

  /* Route to get all bookmarks by author */
  @ValidateUser()
  @Query(() => GetBookmarkResponse)
  async getMyBookmarks(
    @Ctx() { em, request }: MyContext
  ): Promise<GetBookmarkResponse> {
    // since I wil be using a non explicit value from request (userId)
    // I will declare a local req as any
    const req = request as any;

    const bookmarks = await em.find(
      Bookmark,
      { author: req.userId },
      { populate: ["verses"], orderBy: [{ createdAt: -1 }] }
    );

    if (!bookmarks.length) {
      return {
        errors: [
          {
            message: "No bookmarks found",
          },
        ],
      };
    }

    return { results: bookmarks };
  }

  /* Route to update a new bookmark */
  @ValidateUser()
  @Mutation(() => BookmarkResponse)
  async updateBookmark(
    @Arg("options", () => BookmarkOptions) options: BookmarkOptions,
    @Arg("id", () => String) id: string,
    @Ctx() { em, request }: MyContext
  ): Promise<BookmarkResponse> {
    // since I wil be using a non explicit value from request (userId)
    // I will declare a local req as any
    const req = request as any;

    // check to see if the header was set from the middleware
    if (!req.userId) {
      const error: UserResponse = {
        errors: [
          {
            field: "User",
            message: "User cannot be found. Please login first.",
          },
        ],
      };

      return error;
    }

    // find the user
    const user = await em.findOne(User, { _id: req.userId });

    // throw error if user is not found
    if (!user) {
      const error: UserResponse = {
        errors: [
          {
            message: `No user found, try to log in.`,
          },
        ],
      };
      return error;
    }

    // find the chosen bookmark
    const chosenBookmark = await em.findOne(Bookmark, {
      _id: new ObjectId(id),
    });

    // throw error if user is not found
    if (!chosenBookmark) {
      const error: BookmarkResponse = {
        errors: [
          {
            message: `No user found, try to log in.`,
          },
        ],
      };
      return error;
    }

    try {
      em.assign(chosenBookmark, options);
      em.persistAndFlush(chosenBookmark);
    } catch (err) {
      throw err;
    }

    return { results: chosenBookmark };
  }

  /**
   * Route to delete a bookmark by id only if a user is authed
   */
  @ValidateUser()
  @Mutation(() => Boolean || BookmarkResponse)
  async deleteBookmarks(
    @Arg("ids", () => [String]) ids: string[],
    @Ctx() { em, request }: MyContext
  ): Promise<Boolean | BookmarkResponse> {
    // since I wil be using a non explicit value from request (userId)
    // I will declare a local req as any
    const req = request as any;

    // check to see if the header was set from the middleware
    if (!req.userId) {
      const error: UserResponse = {
        errors: [
          {
            field: "User",
            message: "User cannot be found. Please login first.",
          },
        ],
      };

      return error;
    }

    // loop through id
    ids.forEach((id) => {
      // getting the reference of the bookmark
      const bookmark = em.getReference(Bookmark, id);

      em.remove(bookmark);
    });

    em.flush();

    return true;
  }
}
