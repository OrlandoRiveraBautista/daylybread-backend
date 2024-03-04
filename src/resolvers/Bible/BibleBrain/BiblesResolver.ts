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
import { BBMetadata } from "../../../misc/biblebrain/metadataTypes";
import { BBBible } from "../../../misc/biblebrain/bibleTypes";
import { underscoreToCamelCase } from "../../../utility";

/* --- Arguments (Args) Object Input Types --- */
@InputType()
export class BibleArgs {
  @Field({ nullable: true })
  mediaExclude?: string;

  @Field({ nullable: true })
  languageCode?: string;

  @Field({ nullable: true, defaultValue: 1 })
  page?: number;
}

@ObjectType()
export class BibleReponse {
  @Field(() => [BBBible])
  data: [BBBible];

  @Field(() => BBMetadata)
  meta: BBMetadata;
}

/**
 * Resolver to get all possible languages
 */
@Resolver()
export class BiblesResolver {
  @Query(() => BibleReponse || FieldError)
  async getListOFBibles(@Arg("options", () => BibleArgs) options: BibleArgs) {
    // set url with correct params
    const url = `https://4.dbt.io/api/bibles?page=${options.page}
        ${options.languageCode ? `&language_code=${options.languageCode}` : ""}
        ${
          options.mediaExclude ? `&media_excluded=${options.mediaExclude}` : ""
        }`;

    config.url = url;

    try {
      const { data } = await axios<any>(config);
      const camelCaseData: BibleReponse = underscoreToCamelCase(data);

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
