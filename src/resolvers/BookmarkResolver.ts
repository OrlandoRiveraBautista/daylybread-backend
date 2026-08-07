import {
  Arg,
  Ctx,
  Field,
  InputType,
  Mutation,
  Query,
  Resolver,
} from "type-graphql";
import { RequireAuth } from "../middlewares/userAuth";
import {
  BookmarkResponse,
  GetBookmarkResponse,
  MyContext,
  UserResponse,
} from "../types";
import { User } from "../entities/User";
import { Bookmark } from "../entities/Bookmark";
import { ObjectId } from "@mikro-orm/mongodb";
import { BBVerse } from "../misc/biblebrain/verseTypes";
import { omitUndefined } from "../utility";

@InputType()
class BookmarkOptions {
  @Field(() => String, { nullable: true })
  bibleId?: string;

  @Field(() => [String], { nullable: true })
  verses?: string[]; // will be sent as stringified json

  @Field(() => String, { nullable: true })
  note?: string;
}

@Resolver()
export class BookmarkResolver {
  @RequireAuth()
  @Mutation(() => BookmarkResponse)
  async createBookmark(
    @Arg("options", () => BookmarkOptions) options: BookmarkOptions,
    @Ctx() { em, request }: MyContext
  ): Promise<BookmarkResponse> {
    const req = request as any;
    const user = await em.findOne(User, { _id: req.userId });

    if (!user) {
      const error: UserResponse = {
        errors: [{ message: `No user found, try to log in.` }],
      };
      return error;
    }

    const newBookmark = em.create(Bookmark, {
      author: user,
      ...omitUndefined({
        bibleId: options.bibleId,
        note: options.note,
        newVerses: options.verses?.map(
          (verse) => JSON.parse(verse) as BBVerse
        ),
      }),
    });

    await em.persistAndFlush(newBookmark);
    return { results: newBookmark };
  }

  @RequireAuth()
  @Query(() => GetBookmarkResponse)
  async getMyBookmarks(
    @Ctx() { em, request }: MyContext
  ): Promise<GetBookmarkResponse> {
    const req = request as any;

    const bookmarks = await em.find(
      Bookmark,
      { author: req.userId },
      { populate: ["verses"], orderBy: [{ createdAt: -1 }] }
    );

    if (!bookmarks.length) {
      return {
        errors: [{ message: "No bookmarks found" }],
      };
    }

    return { results: bookmarks };
  }

  @RequireAuth()
  @Mutation(() => BookmarkResponse)
  async updateBookmark(
    @Arg("options", () => BookmarkOptions) options: BookmarkOptions,
    @Arg("id", () => String) id: string,
    @Ctx() { em, request }: MyContext
  ): Promise<BookmarkResponse> {
    const req = request as any;
    const user = await em.findOne(User, { _id: req.userId });

    if (!user) {
      const error: UserResponse = {
        errors: [{ message: `No user found, try to log in.` }],
      };
      return error;
    }

    const chosenBookmark = await em.findOne(Bookmark, {
      _id: new ObjectId(id),
      author: user,
    });

    if (!chosenBookmark) {
      return {
        errors: [{ message: "Bookmark not found." }],
      };
    }

    em.assign(
      chosenBookmark,
      omitUndefined({
        bibleId: options.bibleId,
        note: options.note,
        newVerses: options.verses?.map(
          (verse) => JSON.parse(verse) as BBVerse
        ),
      })
    );
    await em.persistAndFlush(chosenBookmark);
    await em.populate(chosenBookmark, ["verses", "author"]);

    return { results: chosenBookmark };
  }

  @RequireAuth()
  @Mutation(() => Boolean)
  async deleteBookmarks(
    @Arg("ids", () => [String]) ids: string[],
    @Ctx() { em, request }: MyContext
  ): Promise<boolean> {
    const req = request as any;
    const objectIds = ids
      .filter((id) => ObjectId.isValid(id))
      .map((id) => new ObjectId(id));

    if (!objectIds.length) {
      return false;
    }

    const bookmarks = await em.find(Bookmark, {
      _id: { $in: objectIds },
      author: req.userId,
    });

    if (!bookmarks.length) {
      return false;
    }

    for (const bookmark of bookmarks) {
      em.remove(bookmark);
    }
    await em.flush();

    return true;
  }
}
