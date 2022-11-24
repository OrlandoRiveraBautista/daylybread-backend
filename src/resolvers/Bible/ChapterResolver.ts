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
    // find book
    const results = await em.findOne(Book, { bibleId: id });

    if (!results) {
      const error: FieldError = {
        message: "Book could not be found. Please try a different one",
      };
      return error;
    }

    // get chapters
    const chapters = results.chapters;

    return chapters;
  }

  // Get  a chapter  by bible id
  @Query(() => Chapter)
  async getChapter(
    @Arg("bibleId", () => String) id: string,
    @Ctx() { em }: MyContext
  ): Promise<Chapter | FieldError> {
    // find chapter
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

  // Text search
  @Query(() => [Chapter])
  async searchBible(
    @Arg("search", () => String) search: string,
    @Ctx() { em }: MyContext
  ): Promise<Chapter[] | FieldError> {
    // find chapter
    const col = em.getCollection(Chapter);
    const trying = col.aggregate([
      {
        $search: {
          index: "default",
          text: {
            path: {
              value: "text",
              multi: "verse_spanish",
            },
            query: search,
          },
          highlight: {
            path: "text",
          },
        },
      },
      {
        $limit: 10,
      },
      {
        $project: {
          verse: 1,
          text: 1,
          bibleId: 1,
          translation: 1,
          chapterNumber: 1,
          bookName: 1,
          score: {
            $meta: "searchScore",
          },
          highlight: {
            $meta: "searchHighlights",
          },
        },
      },
    ]);

    console.log(trying);

    const results = em.find(Chapter, {
      bibleId: "KJV03022",
    });

    if (!results) {
      const error: FieldError = {
        message: "Book could not be found. Please try a different one",
      };
      return error;
    }

    return results;
  }
}
