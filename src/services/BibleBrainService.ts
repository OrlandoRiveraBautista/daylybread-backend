import axios from "axios";
import config from "../misc/biblebrain/axiosConfig";
import { underscoreToCamelCase } from "../utility";
import {
  BibleReponse,
  BookResponse,
  LanguageReponse,
  VerseResponse,
} from "../resolvers/Bible/BibleBrain/types";

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
    /**
     * ! 3/29/2024 mediaInclude is down
     */
    const url = `https://4.dbt.io/api/languages/search/${search}?v=4
    ${mediaInclude ? `&set_type_code=${mediaInclude}` : ""}`;

    config.url = url;

    const { data } = await axios<any>(config);
    const camelCaseData: LanguageReponse = underscoreToCamelCase(data);

    return camelCaseData;
  }

  /**
   * Will return all available titles by language code
   * You can specify media to exclude or include
   */
  public async getAvailableBibles(
    mediaExclude?: string,
    mediaInclude?: string,
    languageCode?: string,
    page?: number
  ) {
    // set url with correct params
    const url = `https://4.dbt.io/api/bibles?page=${page}
        ${languageCode ? `&language_code=${languageCode}` : ""}
        ${mediaExclude ? `&media_excluded=${mediaExclude}` : ""}
        ${mediaInclude ? `&media=${mediaInclude}` : ""}`;

    config.url = url;

    const { data } = await axios<any>(config);
    const camelCaseData: BibleReponse = underscoreToCamelCase(data);
    return camelCaseData;
  }

  public async searchAvailableBibles(
    search?: string,
    // mediaExclude?: string,
    // mediaInclude?: string,
    // languageCode?: string,
    page?: number
  ) {
    // set url with correct params
    const url = `https://4.dbt.io/api/bibles/search/${search}?v=4page=${page}
        `;

    config.url = url;

    const { data } = await axios<any>(config);
    console.log(data);
    const camelCaseData: BibleReponse = underscoreToCamelCase(data);
    return camelCaseData;
  }

  /**
   * Will return all available books for a give bible by bibleId
   */
  public async getAvailableBooks(bibleId: string) {
    // set url pased on if the user picked a country or not
    const url = `https://4.dbt.io/api/bibles/${bibleId}/book?verify_content=true`;

    config.url = url;

    const { data } = await axios<any>(config);
    const camelCaseData: BookResponse = underscoreToCamelCase(data);

    return camelCaseData;
  }

  public async getAvailableVerse(
    bibleId: string,
    bookId: string,
    chapterNumber: number
  ) {
    // set url pased on if the user picked a country or not
    const url = `https://4.dbt.io/api/bibles/filesets/${bibleId}/${bookId}/${chapterNumber}`;

    config.url = url;

    const { data } = await axios<any>(config);

    const camelCaseData: VerseResponse = underscoreToCamelCase(data);
    return camelCaseData;
  }
}

export default BibleBrainService;
