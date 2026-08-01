import { Resolver, Query, Arg, InputType, Field } from "type-graphql";
import { FieldError } from "../../../entities/Errors/FieldError";
import { VerseResponse } from "./types";
import { getBibleBrainService } from "../../../services/BibleBrainService";
import { toBibleBrainError } from "./error";

/* --- Arguments (Args) Object Input Types --- */
@InputType()
export class VerseArgs {
  /** DBP text fileset id (not bible abbreviation). */
  @Field()
  bibleId: string;

  @Field()
  bookId: string;

  @Field()
  chapterNumber: number;
}

/**
 * Resolver to get verses for a fileset / book / chapter.
 */
@Resolver()
export class VersesResolver {
  @Query(() => VerseResponse)
  async getListOfVerseFromBookChapter(
    @Arg("options", () => VerseArgs) options: VerseArgs
  ): Promise<VerseResponse | FieldError> {
    if (!options.bibleId) {
      return {
        message: "Please specify bibleId (text fileset id)",
        field: "bibleId",
      };
    }
    if (!options.bookId) {
      return {
        message: "Please specify bookId",
        field: "bookId",
      };
    }
    if (options.chapterNumber == null) {
      return {
        message: "Please specify chapterNumber",
        field: "chapterNumber",
      };
    }

    const service = getBibleBrainService();

    try {
      return await service.getAvailableVerse(
        options.bibleId,
        options.bookId,
        options.chapterNumber
      );
    } catch (err) {
      return toBibleBrainError(err, "getListOfVerseFromBookChapter");
    }
  }
}
