import { Resolver, Query, Arg, InputType, Field } from "type-graphql";
import { FieldError } from "../../../entities/Errors/FieldError";
import { BibleReponse } from "./types";
import { getBibleBrainService } from "../../../services/BibleBrainService";
import { toBibleBrainError } from "./error";

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
 * Resolver for Bible Brain bible lists / search.
 */
@Resolver()
export class BiblesResolver {
  @Query(() => BibleReponse)
  async getListOFBibles(
    @Arg("options", () => BibleArgs) options: BibleArgs
  ): Promise<BibleReponse | FieldError> {
    const service = getBibleBrainService();

    try {
      return await service.getFilteredAvailableBibles(
        options.mediaExclude,
        options.mediaInclude,
        options.languageCode,
        options.page ?? 1
      );
    } catch (err) {
      return toBibleBrainError(
        err,
        "getListOFBibles"
      );
    }
  }

  @Query(() => BibleReponse)
  async searchListOFBibles(
    @Arg("options", () => BibleSearchArgs) options: BibleSearchArgs
  ): Promise<BibleReponse | FieldError> {
    const service = getBibleBrainService();

    try {
      return await service.searchAvailableBibles(
        options.search,
        options.page ?? 1
      );
    } catch (err) {
      return toBibleBrainError(err, "searchListOFBibles");
    }
  }
}
