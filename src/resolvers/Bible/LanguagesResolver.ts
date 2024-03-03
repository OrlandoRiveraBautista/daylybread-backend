import {
  Resolver,
  Query,
  Arg,
  InputType,
  Field,
  ObjectType,
} from "type-graphql";
import axios from "axios";

import config from "../../misc/biblebrain/axiosConfig";
import { FieldError } from "../../entities/Errors/FieldError";
import { BBLanguage } from "../../misc/biblebrain/languagesTypes";
import { BBMetadata } from "../../misc/biblebrain/metadataTypes";

/* --- Arguments (Args) Object Input Types --- */
@InputType()
export class LanguagesArgs {
  @Field({ nullable: true })
  country?: string;

  @Field({ nullable: true, defaultValue: 1 })
  page?: number;
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
      const { data } = await axios<LanguageReponse>(config);

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
