import { MyContext } from "src/types";
import { Book, BookChapter } from "../../entities/Bible/Book";
import { Chapter } from "../../entities/Bible/Chapter";
import { Resolver, Query, Ctx, Arg } from "type-graphql";
import { FieldError } from "../../entities/Errors/FieldError";

@Resolver()
export class ChapterResolver {
  // Get all of the chapters by book id
  @Query(() => [BookChapter])
  async getChapterListByBookBibleId(
    @Arg("bookBibleId", () => String) id: string,
    @Ctx() { em }: MyContext
  ): Promise<BookChapter[] | FieldError> {
    const results = await em.findOne(Book, { bibleId: id });

    if (!results) {
      const error: FieldError = {
        message: "Book could not be found. Please try a different one",
      };
      return error;
    }

    return results.chapters;
  }

  // Get a chapter by bible id
  @Query(() => Chapter)
  async getChapter(
    @Arg("bibleId", () => String) id: string,
    @Ctx() { em }: MyContext
  ): Promise<Chapter | FieldError> {
    const results = await em.findOne(Chapter, {
      bibleId: id,
    });

    if (!results) {
      const error: FieldError = {
        message: "Chapter could not be found. Please try a different one",
      };
      return error;
    }

    return results;
  }

  @Query(() => [Chapter])
  async searchBible(
    @Arg("search", () => String) search: string,
    @Ctx() { em }: MyContext
  ): Promise<Chapter[]> {
    const trimmed = search?.trim();
    if (!trimmed) {
      return [];
    }

    const col = em.getCollection(Chapter);
    const cursor = col.aggregate([
      {
        $search: {
          index: "default",
          text: {
            path: {
              value: "text",
              multi: "verse_spanish",
            },
            query: trimmed,
          },
          highlight: {
            path: "text",
          },
        },
      },
      { $limit: 10 },
      {
        $project: {
          verse: 1,
          text: 1,
          bibleId: 1,
          translation: 1,
          chapterNumber: 1,
          bookName: 1,
          score: { $meta: "searchScore" },
          highlight: { $meta: "searchHighlights" },
        },
      },
    ]);

    const results = await cursor.toArray();
    return results as Chapter[];
  }
}
