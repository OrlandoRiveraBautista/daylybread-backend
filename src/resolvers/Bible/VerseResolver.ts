import { MyContext } from "../../types";
import { Verse } from "../../entities/Bible/Verse";
import { Chapter, ChapterVerse } from "../../entities/Bible/Chapter";
import { Resolver, Query, Ctx, Arg } from "type-graphql";
import { FieldError } from "../../entities/Errors/FieldError";

@Resolver()
export class VerseResolver {
  // Get all chapter verses for a given bible id
  @Query(() => [ChapterVerse])
  async getVerseListByChapterBibleId(
    @Arg("chapterBibleId", () => String) id: string,
    @Ctx() { em }: MyContext
  ): Promise<ChapterVerse[] | FieldError> {
    // find chapter
    const results = await em.findOne(Chapter, { bibleId: id });

    if (!results) {
      const error: FieldError = {
        message: "Chapter could not be found. Please try a new one",
      };
      return error;
    }

    // get verses
    const verses = results.verses;

    return verses;
  }

  // Get a verse by a given bible id
  @Query(() => Verse)
  async getVerseByBibleId(
    @Arg("bibleId", () => String) id: string,
    @Ctx() { em }: MyContext
  ): Promise<Verse | FieldError> {
    // find verse
    const result = await em.findOne(Verse, { bibleId: id });

    if (!result) {
      const error: FieldError = {
        message: "Verse could not be found. Please try a new one",
      };
      return error;
    }
    return result;
  }
}
