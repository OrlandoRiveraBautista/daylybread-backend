import { Resolver, Query, Arg, InputType, Field } from "type-graphql";
import { FieldError } from "../../../entities/Errors/FieldError";
import { CopyrightResponse } from "./types";
import { getBibleBrainService } from "../../../services/BibleBrainService";
import { toBibleBrainError } from "./error";

/* --- Arguments (Args) Object Input Types --- */
@InputType()
export class CopyrightArgs {
  @Field()
  bibleId: string;
}

/**
 * Resolver for Bible Brain copyright metadata.
 */
@Resolver()
export class CopyrightResolver {
  @Query(() => CopyrightResponse)
  async getCopyRightByBibleId(
    @Arg("options", () => CopyrightArgs) options: CopyrightArgs
  ): Promise<CopyrightResponse | FieldError> {
    if (!options.bibleId) {
      return {
        message: "Please specify bibleId",
        field: "bibleId",
      };
    }

    const service = getBibleBrainService();

    try {
      return await service.getCopyright(options.bibleId);
    } catch (err) {
      return toBibleBrainError(err, "getCopyRightByBibleId");
    }
  }
}
