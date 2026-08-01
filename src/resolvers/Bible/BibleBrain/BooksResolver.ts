import { Resolver, Query, Arg, InputType, Field } from "type-graphql";
import { FieldError } from "../../../entities/Errors/FieldError";
import { BookResponse } from "./types";
import { getBibleBrainService } from "../../../services/BibleBrainService";
import { toBibleBrainError } from "./error";

/* --- Arguments (Args) Object Input Types --- */
@InputType()
export class BookArgs {
  @Field()
  bibleId: string;
}

/**
 * Resolver to get all books for a given bible by bible id / abbreviation.
 */
@Resolver()
export class BooksResolver {
  @Query(() => BookResponse)
  async getListOfBooksForBible(
    @Arg("options", () => BookArgs) options: BookArgs
  ): Promise<BookResponse | FieldError> {
    if (!options.bibleId) {
      return {
        message: "Please specify bibleId",
        field: "bibleId",
      };
    }

    const service = getBibleBrainService();

    try {
      return await service.getAvailableBooks(options.bibleId);
    } catch (err) {
      return toBibleBrainError(err, "getListOfBooksForBible");
    }
  }
}
