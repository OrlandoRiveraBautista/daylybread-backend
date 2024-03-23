import { Resolver, Query, Arg, InputType, Field } from "type-graphql";

/* Services */
import BibleBrainService from "../../../services/BibleBrainService";

import { FieldError } from "../../../entities/Errors/FieldError";
import { LanguageReponse } from "./types";

/* --- Arguments (Args) Object Input Types --- */
@InputType()
export class LanguagesArgs {
  @Field({ nullable: true })
  country?: string;

  @Field({ nullable: true, defaultValue: 1 })
  page?: number;
}

@InputType()
export class SearchLanguageArgs {
  @Field({ nullable: true })
  search?: string;

  @Field({ nullable: true })
  mediaInclude?: string;
}

/**
 * Resolver to get all possible languages
 */
@Resolver()
export class LanguagesResolver {
  @Query(() => LanguageReponse || FieldError)
  async getListOfLanguages(
    @Arg("options", () => LanguagesArgs) options: LanguagesArgs
  ) {
    const service = new BibleBrainService();

    try {
      const data = await service.getAvailableLanguages(
        options.country,
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

  @Query(() => LanguageReponse || FieldError)
  async searchListOfLanguages(
    @Arg("options", () => SearchLanguageArgs) options: SearchLanguageArgs
  ) {
    const service = new BibleBrainService();

    try {
      const data = await service.searchAvailableLanguages(
        options.search,
        options.mediaInclude
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
