import {
  Resolver,
  Query,
  Arg,
  InputType,
  Field,
  ObjectType,
} from "type-graphql";
import axios from "axios";

import config from "../../../misc/biblebrain/axiosConfig";
import { FieldError } from "../../../entities/Errors/FieldError";
import { BBBook } from "../../../misc/biblebrain/bookTypes";
import { underscoreToCamelCase } from "../../../utility";

/* --- Arguments (Args) Object Input Types --- */
@InputType()
export class BookArgs {
  @Field()
  bibleId: string;
}

@ObjectType()
export class BookResponse {
  @Field(() => [BBBook])
  data: [BBBook];
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

    // set url pased on if the user picked a country or not
    const url = `https://4.dbt.io/api/bibles/${options.bibleId}/book?verify_content=true`;

    config.url = url;

    try {
      const { data } = await axios<any>(config);
      const camelCaseData: BookResponse = underscoreToCamelCase(data);

      return camelCaseData;
    } catch (err) {
      const error: FieldError = {
        message: err,
        field: "Calling to get all languages available in Bible Brain",
      };

      return error;
    }
  }
}
