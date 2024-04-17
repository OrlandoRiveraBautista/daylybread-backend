import { Resolver, Query, Arg, InputType, Field } from "type-graphql";
import { FieldError } from "../../../entities/Errors/FieldError";
import { BookResponse } from "./types";
import BibleBrainService from "../../../services/BibleBrainService";

/* --- Arguments (Args) Object Input Types --- */
@InputType()
export class BookArgs {
  @Field()
  bibleId: string;
}

/**
 * Resolver to get all books for a given bible by bible id
 */
@Resolver()
export class BooksResolver {
  @Query(() => BookResponse || FieldError)
  async getListOfBooksForBible(
    @Arg("options", () => BookArgs) options: BookArgs
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
      const data = service.getAvailableBooks(options.bibleId);

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
