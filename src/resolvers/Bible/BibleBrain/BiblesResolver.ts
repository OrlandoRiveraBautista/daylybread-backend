import { Resolver, Query, Arg, InputType, Field } from "type-graphql";
import { FieldError } from "../../../entities/Errors/FieldError";
import { BibleReponse } from "./types";
import BibleBrainService from "../../../services/BibleBrainService";

/* --- Arguments (Args) Object Input Types --- */
@InputType()
export class BibleArgs {
  @Field({ nullable: true })
  mediaExclude?: string;

  @Field({ nullable: true })
  mediaInclude?: string;

  @Field({ nullable: true })
  languageCode?: string;

  @Field({ nullable: true, defaultValue: 1 })
  page?: number;
}

@InputType()
export class BibleSearchArgs extends BibleArgs {
  @Field({ nullable: true })
  search?: string;
}

/**
 * Resolver to get all possible languages
 */
@Resolver()
export class BiblesResolver {
  @Query(() => BibleReponse || FieldError)
  async getListOFBibles(@Arg("options", () => BibleArgs) options: BibleArgs) {
    const service = new BibleBrainService();

    try {
      const data = await service.getAvailableBibles(
        options.mediaExclude,
        options.mediaInclude,
        options.languageCode,
        options.page
      );

      // Filter and parse data
      const filteredData = await Promise.all(
        // Map through the api data
        data.data.map(async (bible) => {
          // Fail if the abbr is missing
          if (!bible.abbr) return;

          // Get the available books for the bible
          const availableBooks = (await service.getAvailableBooks(bible.abbr))
            .data;

          let hasAP = false;
          let otCount = 0;

          availableBooks.forEach((book) => {
            if (book.testament === "OT") otCount++;
            if (book.testament === "AP") {
              hasAP = true;
              return; // Stop checking once an AP book is found
            }
          });

          if (otCount === 46 || hasAP) return;

          return bible;
        })
      );

      // Filter out undefined values directly
      return {
        data: filteredData.flatMap((bible) => (bible ? [bible] : [])),
        meta: data.meta,
      };
    } catch (err) {
      const error: FieldError = {
        message: err,
        field: "Calling to get all languages available in Bible Brain",
      };

      return error;
    }
  }

  @Query(() => BibleReponse || FieldError)
  async searchListOFBibles(
    @Arg("options", () => BibleSearchArgs) options: BibleSearchArgs
  ) {
    const service = new BibleBrainService();

    try {
      const data = await service.searchAvailableBibles(
        options.search,
        // options.mediaExclude,
        // options.mediaInclude,
        // options.languageCode,
        options.page
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
