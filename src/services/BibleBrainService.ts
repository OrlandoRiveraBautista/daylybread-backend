import axios from "axios";
import config from "../misc/biblebrain/axiosConfig";
import { underscoreToCamelCase } from "../utility";
import {
  AudioMediaResponse,
  BibleReponse,
  BookResponse,
  CopyrightResponse,
  LanguageReponse,
  VerseResponse,
} from "../resolvers/Bible/BibleBrain/types";
import { Class } from "type-fest";

class BibleBrainService {
  constructor() {}

  /**
   * Function to call the bible brain service specifying the url and response type
   * @param url
   * @param responseType
   * @returns An object with the response type you have provided
   */
  private async callService(url: string, responseType: Class<any>) {
    config.url = url;

    const { data } = await axios<any>(config);
    const camelCaseData: typeof responseType = underscoreToCamelCase(data);

    return camelCaseData;
  }

  /**
   * Will return all available languages.
   * You can specify a country or leave it blank for all languages
   */
  public async getAvailableLanguages(country?: string, page: number = 1) {
    // set url pased on if the user picked a country or not
    const url = country
      ? `https://4.dbt.io/api/languages?include_alt_names=true&country=${country}&v=4&page=${page}`
      : `https://4.dbt.io/api/languages?v=4&page=${page}`;

    const response = await this.callService(url, LanguageReponse);

    return response;
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

    const response = await this.callService(url, LanguageReponse);

    return response;
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

    const response = await this.callService(url, BibleReponse);

    return response;
  }

  public async searchAvailableBibles(search?: string, page?: number) {
    // set url with correct params
    const url = `https://4.dbt.io/api/bibles/search/${search}?v=4page=${page}`;

    const response = await this.callService(url, BibleReponse);

    return response;
  }

  /**
   * Will return all available books for a give bible by bibleId
   */
  public async getAvailableBooks(bibleId: string) {
    // set url pased on if the user picked a country or not
    const url = `https://4.dbt.io/api/bibles/${bibleId}/book?verify_content=true`;

    const response = await this.callService(url, BookResponse);

    return response;
  }

  public async getAvailableVerse(
    bibleId: string,
    bookId: string,
    chapterNumber: number
  ) {
    // set url pased on if the user picked a country or not
    const url = `https://4.dbt.io/api/bibles/filesets/${bibleId}/${bookId}/${chapterNumber}`;

    const response = await this.callService(url, VerseResponse);

    return response;
  }

  public async getCopyright(bibleId: string) {
    const url = `https://4.dbt.io/api/bibles/${bibleId}/copyright?&v=4`;

    const response = await this.callService(url, CopyrightResponse);

    return { data: response }; // copyright response a bit different
  }

  public async getMedia(
    filesetId: string,
    bookId: string,
    chapterNumber: number
  ) {
    const url = `https://4.dbt.io/api/bibles/filesets/${filesetId}/${bookId}/${chapterNumber}`;

    const response = await this.callService(url, AudioMediaResponse);

    return response;
  }
}

export default BibleBrainService;
