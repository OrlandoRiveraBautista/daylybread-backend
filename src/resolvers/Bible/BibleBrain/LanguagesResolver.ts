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
import { BBLanguage } from "../../../misc/biblebrain/languagesTypes";
import { BBMetadata } from "../../../misc/biblebrain/metadataTypes";
import { underscoreToCamelCase } from "../../../utility";

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

@ObjectType()
export class LanguageReponse {
  @Field(() => [BBLanguage])
  data: [BBLanguage];

  @Field(() => BBMetadata)
  meta: BBMetadata;
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
    // set url pased on if the user picked a country or not
    const url = options.country
      ? `https://4.dbt.io/api/languages?include_alt_names=true&country=${options.country}&v=4&page=${options.page}`
      : `https://4.dbt.io/api/languages?v=4&page=${options.page}`;

    config.url = url;

    try {
      const { data } = await axios<any>(config);
      const camelCaseData: LanguageReponse = underscoreToCamelCase(data);

      return camelCaseData;
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
    // set url pased on if the user picked a country or not
    const url = `https://4.dbt.io/api/languages/search/${options.search}?v=4
    ${options.mediaInclude ? `&set_type_code=${options.mediaInclude}` : ""}`;

    config.url = url;

    try {
      const { data } = await axios<any>(config);
      const camelCaseData: LanguageReponse = underscoreToCamelCase(data);

      console.log(camelCaseData);
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
