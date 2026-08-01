import { underscoreToCamelCase } from "../utility";
import { bibleBrainGet } from "../misc/biblebrain/client";
import { bibleBrainCache } from "../misc/biblebrain/ttlCache";
import { mapLimit } from "../misc/biblebrain/mapLimit";
import {
  AudioMediaResponse,
  BibleReponse,
  BookResponse,
  CopyrightResponse,
  LanguageReponse,
  MediaTimestampResponse,
  VerseResponse,
} from "../resolvers/Bible/BibleBrain/types";
import { BBBible } from "../misc/biblebrain/bibleTypes";
import { BBBook } from "../misc/biblebrain/bookTypes";
import { BBMetadata } from "../misc/biblebrain/metadataTypes";

const TTL = {
  languages: 6 * 60 * 60 * 1000, // 6h
  bibles: 2 * 60 * 60 * 1000, // 2h
  books: 24 * 60 * 60 * 1000, // 24h
  verses: 60 * 60 * 1000, // 1h
  media: 60 * 60 * 1000, // 1h
  copyright: 24 * 60 * 60 * 1000, // 24h
  filteredList: 60 * 60 * 1000, // 1h
} as const;

const BOOK_FANOUT_CONCURRENCY =
  Number(process.env.BIBLE_BRAIN_BOOK_CONCURRENCY) || 5;

type CanonInfo = {
  include: boolean;
  books: BBBook[];
};

function asResponse<T extends object>(
  ResponseType: new () => T,
  data: unknown,
  camelCase = true
): T {
  const payload = camelCase ? underscoreToCamelCase(data) : data;
  return Object.assign(new ResponseType(), payload);
}

function normalizeListPayload<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === "object" && Array.isArray((raw as { data?: unknown }).data)) {
    return (raw as { data: T[] }).data;
  }
  return [];
}

class BibleBrainService {
  /**
   * Cached GET with optional camelCase transform into a response class.
   */
  private async cachedGet<T extends object>(
    cacheKey: string,
    ttlMs: number,
    path: string,
    ResponseType: new () => T,
    params?: Record<string, string | number | boolean | undefined>,
    camelCase = true
  ): Promise<T> {
    return bibleBrainCache.getOrSet(cacheKey, ttlMs, async () => {
      const data = await bibleBrainGet(path, params);
      return asResponse(ResponseType, data, camelCase);
    });
  }

  /** All available languages (optionally by country). */
  public async getAvailableLanguages(country?: string, page: number = 1) {
    const cacheKey = `languages:${country || "all"}:${page}`;
    return this.cachedGet(
      cacheKey,
      TTL.languages,
      "/api/languages",
      LanguageReponse,
      {
        page,
        include_alt_names: country ? true : undefined,
        country,
      }
    );
  }

  /** Language search. */
  public async searchAvailableLanguages(
    search?: string,
    mediaInclude?: string
  ) {
    const term = (search || "").trim();
    if (!term) {
      return asResponse(LanguageReponse, { data: [], meta: { pagination: {} } });
    }

    const cacheKey = `languages:search:${term}:${mediaInclude || ""}`;
    return this.cachedGet(
      cacheKey,
      TTL.languages,
      `/api/languages/search/${encodeURIComponent(term)}`,
      LanguageReponse,
      {
        set_type_code: mediaInclude,
      }
    );
  }

  /** Available bibles by language / media filters. */
  public async getAvailableBibles(
    mediaExclude?: string,
    mediaInclude?: string,
    languageCode?: string,
    page: number = 1
  ) {
    const cacheKey = `bibles:${languageCode || ""}:${mediaInclude || ""}:${mediaExclude || ""}:${page}`;
    return this.cachedGet(
      cacheKey,
      TTL.bibles,
      "/api/bibles",
      BibleReponse,
      {
        page,
        language_code: languageCode,
        media_excluded: mediaExclude,
        media: mediaInclude,
      }
    );
  }

  /** Search bibles by title/term. */
  public async searchAvailableBibles(search?: string, page: number = 1) {
    const term = (search || "").trim();
    if (!term) {
      return asResponse(BibleReponse, { data: [], meta: { pagination: {} } });
    }

    const cacheKey = `bibles:search:${term}:${page}`;
    return this.cachedGet(
      cacheKey,
      TTL.bibles,
      `/api/bibles/search/${encodeURIComponent(term)}`,
      BibleReponse,
      { page }
    );
  }

  /** Books for a bible abbreviation / id. */
  public async getAvailableBooks(bibleId: string) {
    const cacheKey = `books:${bibleId}`;
    return this.cachedGet(
      cacheKey,
      TTL.books,
      `/api/bibles/${encodeURIComponent(bibleId)}/book`,
      BookResponse,
      { verify_content: true }
    );
  }

  /**
   * Canon filter used by bible list: exclude deuterocanonical / Catholic OT sets.
   * Cached per abbreviation so list fan-out is cheap after warm-up.
   */
  public async getCanonInfo(bibleAbbr: string): Promise<CanonInfo> {
    const cacheKey = `canon:${bibleAbbr}`;
    return bibleBrainCache.getOrSet(cacheKey, TTL.books, async () => {
      const { data: books } = await this.getAvailableBooks(bibleAbbr);
      let hasAP = false;
      let otCount = 0;

      for (const book of books || []) {
        if (book.testament === "OT") otCount++;
        if (book.testament === "AP") {
          hasAP = true;
          break;
        }
      }

      return {
        include: !(otCount === 46 || hasAP),
        books: books || [],
      };
    });
  }

  /**
   * Filtered bible list: protestant / non-AP only.
   * Uses cached canon checks + concurrency cap instead of unbounded Promise.all.
   */
  public async getFilteredAvailableBibles(
    mediaExclude?: string,
    mediaInclude?: string,
    languageCode?: string,
    page: number = 1
  ): Promise<BibleReponse> {
    const cacheKey = `bibles:filtered:${languageCode || ""}:${mediaInclude || ""}:${mediaExclude || ""}:${page}`;

    return bibleBrainCache.getOrSet(cacheKey, TTL.filteredList, async () => {
      const list = await this.getAvailableBibles(
        mediaExclude,
        mediaInclude,
        languageCode,
        page
      );

      const bibles = (list.data || []) as BBBible[];
      const decisions = await mapLimit(
        bibles,
        BOOK_FANOUT_CONCURRENCY,
        async (bible) => {
          if (!bible.abbr) return null;
          const { include } = await this.getCanonInfo(bible.abbr);
          return include ? bible : null;
        }
      );

      const filtered = decisions.filter((b): b is BBBible => b !== null);
      const pagination = list.meta?.pagination
        ? {
            ...list.meta.pagination,
            count: filtered.length,
          }
        : { count: filtered.length };

      const response = new BibleReponse();
      response.data = filtered as BibleReponse["data"];
      response.meta = { pagination } as BBMetadata;
      return response;
    });
  }

  /**
   * Verses for a chapter.
   * Note: `bibleId` here is a DBP text fileset id, not a bible abbreviation.
   */
  public async getAvailableVerse(
    filesetId: string,
    bookId: string,
    chapterNumber: number
  ) {
    const cacheKey = `verses:${filesetId}:${bookId}:${chapterNumber}`;
    return this.cachedGet(
      cacheKey,
      TTL.verses,
      `/api/bibles/filesets/${encodeURIComponent(filesetId)}/${encodeURIComponent(bookId)}/${chapterNumber}`,
      VerseResponse
    );
  }

  /**
   * Copyright for a bible. Keeps snake_case keys to match GraphQL field names
   * (`asset_id`, `copyright_date`, etc.).
   */
  public async getCopyright(bibleId: string): Promise<CopyrightResponse> {
    const cacheKey = `copyright:${bibleId}`;
    return bibleBrainCache.getOrSet(cacheKey, TTL.copyright, async () => {
      const raw = await bibleBrainGet(
        `/api/bibles/${encodeURIComponent(bibleId)}/copyright`
      );
      const response = new CopyrightResponse();
      response.data = normalizeListPayload(raw) as CopyrightResponse["data"];
      return response;
    });
  }

  /**
   * Audio media for a fileset/chapter. Keeps snake_case for GraphQL fields.
   */
  public async getMedia(
    filesetId: string,
    bookId: string,
    chapterNumber: number
  ): Promise<AudioMediaResponse> {
    const cacheKey = `media:${filesetId}:${bookId}:${chapterNumber}`;
    return bibleBrainCache.getOrSet(cacheKey, TTL.media, async () => {
      const raw = await bibleBrainGet(
        `/api/bibles/filesets/${encodeURIComponent(filesetId)}/${encodeURIComponent(bookId)}/${chapterNumber}`
      );
      const response = new AudioMediaResponse();
      response.data = normalizeListPayload(raw) as AudioMediaResponse["data"];
      return response;
    });
  }

  /**
   * Verse timestamps for audio. Keeps snake_case for GraphQL fields.
   */
  public async getMediaTimestamps(
    filesetId: string,
    bookId: string,
    chapterNumber: number
  ): Promise<MediaTimestampResponse> {
    const cacheKey = `timestamps:${filesetId}:${bookId}:${chapterNumber}`;
    return bibleBrainCache.getOrSet(cacheKey, TTL.media, async () => {
      const raw = await bibleBrainGet(
        `/api/timestamps/${encodeURIComponent(filesetId)}/${encodeURIComponent(bookId)}/${chapterNumber}`
      );
      const response = new MediaTimestampResponse();
      response.data = normalizeListPayload(
        raw
      ) as MediaTimestampResponse["data"];
      return response;
    });
  }
}

let sharedInstance: BibleBrainService | undefined;

/** Shared singleton — safe because the HTTP client never mutates per-request state. */
export function getBibleBrainService(): BibleBrainService {
  if (!sharedInstance) {
    sharedInstance = new BibleBrainService();
  }
  return sharedInstance;
}

export default BibleBrainService;
