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
