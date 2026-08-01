import { Resolver, Query, Arg, InputType, Field } from "type-graphql";
import { getBibleBrainService } from "../../../services/BibleBrainService";
import { FieldError } from "../../../entities/Errors/FieldError";
import { LanguageReponse } from "./types";
import { toBibleBrainError } from "./error";

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
 * Resolver for Bible Brain languages.
 */
@Resolver()
export class LanguagesResolver {
  @Query(() => LanguageReponse)
  async getListOfLanguages(
    @Arg("options", () => LanguagesArgs) options: LanguagesArgs
  ): Promise<LanguageReponse | FieldError> {
    const service = getBibleBrainService();

    try {
      return await service.getAvailableLanguages(
        options.country,
        options.page ?? 1
      );
    } catch (err) {
      return toBibleBrainError(err, "getListOfLanguages");
    }
  }

  @Query(() => LanguageReponse)
  async searchListOfLanguages(
    @Arg("options", () => SearchLanguageArgs) options: SearchLanguageArgs
  ): Promise<LanguageReponse | FieldError> {
    const service = getBibleBrainService();

    try {
      return await service.searchAvailableLanguages(
        options.search,
        options.mediaInclude
      );
    } catch (err) {
      return toBibleBrainError(err, "searchListOfLanguages");
    }
  }
}
