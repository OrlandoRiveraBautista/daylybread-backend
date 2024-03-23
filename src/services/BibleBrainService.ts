import axios from "axios";
import config from "../misc/biblebrain/axiosConfig";
import { underscoreToCamelCase } from "../utility";
import { LanguageReponse } from "../resolvers/Bible/BibleBrain/types";

class BibleBrainService {
  constructor() {}

  /**
   * Will return all available languages.
   * You can specify a country or leave it blank for all languages
   */
  public async getAvailableLanguages(country?: string, page: number = 1) {
    // set url pased on if the user picked a country or not
    const url = country
      ? `https://4.dbt.io/api/languages?include_alt_names=true&country=${country}&v=4&page=${page}`
      : `https://4.dbt.io/api/languages?v=4&page=${page}`;

    config.url = url;

    const { data } = await axios<any>(config);

    const camelCaseData: LanguageReponse = underscoreToCamelCase(data);

    return camelCaseData;
  }

  /**
   * Will return a list of languages from a search.
   * You can also specify the media you want to include in your search, all other medias will be excluded.
   */
  public async searchAvailableLanguages(
    search?: string,
    mediaInclude?: string
  ) {
    // set url pased on if the user picked a country or not
    const url = `https://4.dbt.io/api/languages/search/${search}?v=4
    ${mediaInclude ? `&set_type_code=${mediaInclude}` : ""}`;

    config.url = url;

    const { data } = await axios<any>(config);
    const camelCaseData: LanguageReponse = underscoreToCamelCase(data);

    return camelCaseData;
  }
}

export default BibleBrainService;
