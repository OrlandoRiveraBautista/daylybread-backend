import { Resolver, Query, Arg, InputType, Field } from "type-graphql";
import { FieldError } from "../../../entities/Errors/FieldError";
import { CopyrightResponse } from "./types";
import BibleBrainService from "../../../services/BibleBrainService";

/* --- Arguments (Args) Object Input Types --- */
@InputType()
export class CopyrightArgs {
  @Field()
  bibleId: string;
}

/**
 * Resolver to get all books for a given bible by bible id
 */
@Resolver()
export class CopyrightResolver {
  @Query(() => CopyrightResponse || FieldError)
  async getCopyRightByBibleId(
    @Arg("options", () => CopyrightArgs) options: CopyrightArgs
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
      const data = await service.getCopyright(options.bibleId);
      return data;
    } catch (err) {
      const error: FieldError = {
        message: err,
        field: "Calling to get copyright information from bible brain.",
      };

      return error;
    }
  }
}
