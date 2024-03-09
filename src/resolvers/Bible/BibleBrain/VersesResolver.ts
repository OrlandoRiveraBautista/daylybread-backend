import {
  Resolver,
  Query,
  Arg,
  InputType,
  Field,
  ObjectType,
} from "type-graphql";
import axios from "axios";
import { underscoreToCamelCase } from "../../../utility";
import config from "../../../misc/biblebrain/axiosConfig";
import { FieldError } from "../../../entities/Errors/FieldError";
import { BBVerse } from "../../../misc/biblebrain/verseTypes";

/* --- Arguments (Args) Object Input Types --- */
@InputType()
export class VerseArgs {
  @Field()
  bibleId: string;

  @Field()
  bookId: string;

  @Field()
  chapterNumber: number;
}

@ObjectType()
export class VerseResponse {
  @Field(() => [BBVerse])
  data: [BBVerse];
}

/**
 * Resolver to get all books for a given bible by bible id
 */
@Resolver()
export class VersesResolver {
  @Query(() => VerseResponse || FieldError)
  async getListOfVerseFromBookChapter(
    @Arg("options", () => VerseArgs) options: VerseArgs
  ) {
    if (!options.bibleId) {
      const error: FieldError = {
        message: "Please specify bibleId",
        field: "bibleId",
      };

      return error;
    }

    // set url pased on if the user picked a country or not
    const url = `https://4.dbt.io/api/bibles/filesets/${options.bibleId}/${options.bookId}/${options.chapterNumber}`;

    config.url = url;

    try {
      const { data } = await axios<any>(config);

      const camelCaseData: VerseResponse = underscoreToCamelCase(data);

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
