import { Resolver, Query, Arg, InputType, Field } from "type-graphql";
import { FieldError } from "../../../entities/Errors/FieldError";
import { VerseResponse } from "./types";
import BibleBrainService from "../../../services/BibleBrainService";

/* --- Arguments (Args) Object Input Types --- */
@InputType()
export class VerseArgs {
  @Field()
  bibleId: string;

  @Field()
  bookId: string;

  @Field()
  chapterNumber: number;
}

/**
 * Resolver to get all books for a given bible by bible id
 */
@Resolver()
export class VersesResolver {
  @Query(() => VerseResponse || FieldError)
  async getListOfVerseFromBookChapter(
    @Arg("options", () => VerseArgs) options: VerseArgs
  ) {
    if (!options.bibleId) {
      const error: FieldError = {
        message: "Please specify bibleId",
        field: "bibleId",
      };

      return error;
    }

    const service = new BibleBrainService();

    try {
      const data = service.getAvailableVerse(
        options.bibleId,
        options.bookId,
        options.chapterNumber
      );

      return data;
    } catch (err) {
      const error: FieldError = {
        message: err,
        field: "Calling to get all languages available in Bible Brain",
      };

      return error;
    }
  }
}
