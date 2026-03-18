import {
  Resolver,
  Query,
  Arg,
  Ctx,
  Mutation,
  Field,
  ObjectType,
} from "type-graphql";
import { Song, SongInput } from "../../../entities/Worship/Song";
import { MyContext } from "../../../types";
import { ObjectId } from "@mikro-orm/mongodb";
import { User } from "../../../entities/User";
import { FieldError } from "../../../entities/Errors/FieldError";
import { ValidateUser } from "../../../middlewares/userAuth";
import axios from "axios";
import * as cheerio from "cheerio";
import puppeteer from "puppeteer";

@ObjectType()
class FetchChordsResponse {
  @Field(() => String, { nullable: true })
  rawText?: string;

  @Field(() => String, { nullable: true })
  title?: string;

  @Field(() => String, { nullable: true })
  artist?: string;

  @Field(() => String, { nullable: true })
  key?: string;

  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];
}

@ObjectType()
class SongResponse {
  @Field(() => Song, { nullable: true })
  results?: Song;

  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];
}

@ObjectType()
class SongsResponse {
  @Field(() => [Song], { nullable: true })
  results?: Song[];

  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];
}

// ── HTML extraction helper ─────────────────────────────────────────────────
// Called with both the fast cheerio pass and the Puppeteer-rendered HTML.
function extractFromHtml(
  html: string,
  hostname: string
): { rawText?: string; title?: string; artist?: string; key?: string } {
  const $ = cheerio.load(html);

  let rawText = "";
  let title = "";
  let artist = "";
  let key = "";

  if (hostname.includes("lacuerda.net")) {
    title = $("h1 a").first().text().trim() || $("h1").first().text().trim();
    artist = $("h2 a").first().text().trim() || $("h2").first().text().trim();

    // Key: La Cuerda embeds `odes='D Am7 C G'` in an inline script —
    // the first chord in that list is the song's key.
    const odesMatch = html.match(/odes='([^']+)'/);
    if (odesMatch) {
      const firstChord = odesMatch[1].trim().split(/\s+/)[0];
      if (firstChord) key = firstChord;
    }

    // Chords: pick the largest PRE (first one is an empty #tCode shell).
    // Chords are wrapped in <A> tags — strip inner HTML noise.
    let bestPre = "";
    $("pre, PRE").each((_i, el) => {
      const text = $(el).text().trim();
      if (text.length > bestPre.length) bestPre = text;
    });
    if (!bestPre) {
      $("pre, PRE").each((_i, el) => {
        const inner = $(el).html() || "";
        const stripped = inner
          .replace(/<div[^>]*><\/div>/gi, "")
          .replace(/<[^>]+>/g, "")
          .trim();
        if (stripped.length > bestPre.length) bestPre = stripped;
      });
    }
    rawText = bestPre;

  } else if (hostname.includes("cifraclub.com")) {
    title = $("h1.t1").first().text().trim();
    artist = $("h2.t3 a").first().text().trim() || $("h2 a").first().text().trim();

    // Key: CifraClub embeds `key: 'F'` in an inline JS config object.
    const keyMatch = html.match(/\bkey:\s*'([A-G][#b]?m?)'/);
    if (keyMatch) key = keyMatch[1];

    // Chords: largest <pre> (cheerio strips the <b> chord wrappers via .text())
    let bestPre = "";
    $("pre").each((_i, el) => {
      const text = $(el).text().trim();
      if (text.length > bestPre.length) bestPre = text;
    });
    rawText = bestPre;

  } else if (hostname.includes("ultimate-guitar.com")) {
    const storeData = $(".js-store").attr("data-content") || "";
    if (storeData) {
      try {
        const data = JSON.parse(storeData);
        const content = data?.store?.page?.data?.tab_view?.wiki_tab?.content || "";
        rawText = content
          .replace(/\[tab\]/gi, "")
          .replace(/\[\/tab\]/gi, "")
          .replace(/\[ch\]/gi, "")
          .replace(/\[\/ch\]/gi, "");
        title = data?.store?.page?.data?.tab?.song_name || "";
        artist = data?.store?.page?.data?.tab?.artist_name || "";
        // UG stores the key in the tab object
        key = data?.store?.page?.data?.tab?.tonality_name || "";
      } catch {
        // fall through to generic pre scan
      }
    }
    if (!rawText) {
      $("pre").each((_i, el) => {
        const text = $(el).text().trim();
        if (text.length > rawText.length) rawText = text;
      });
    }

  } else {
    // Generic: pick the largest <pre> block on the page
    $("pre").each((_i, el) => {
      const text = $(el).text().trim();
      if (text.length > rawText.length) rawText = text;
    });
    title = $("h1").first().text().trim();
    artist = $("h2").first().text().trim();
  }

  return {
    rawText: rawText.trim() || undefined,
    title: title || undefined,
    artist: artist || undefined,
    key: key || undefined,
  };
}

@Resolver()
export class SongResolver {
  @ValidateUser()
  @Query(() => FetchChordsResponse)
  async fetchChordsFromUrl(
    @Arg("url") url: string
  ): Promise<FetchChordsResponse> {
    // Validate URL before doing anything
    let hostname: string;
    try {
      hostname = new URL(url).hostname.replace("www.", "");
    } catch {
      return { errors: [{ field: "url", message: "Invalid URL. Please enter a valid link." }] };
    }

    // ── Step 1: fast cheerio path ──────────────────────────────
    // Only falls through to Puppeteer on a network/fetch error,
    // not when the page loaded but had no chord content.
    let cheerioFailed = false;
    try {
      const response = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "es,en;q=0.9",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        timeout: 12000,
      });
      const result = extractFromHtml(response.data, hostname);
      if (result.rawText) return result;
      // Page loaded but no chords found — try Puppeteer in case JS renders them
    } catch {
      cheerioFailed = true;
    }

    // ── Step 2: Puppeteer fallback (JS-rendered pages) ─────────
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      });
      const page = await browser.newPage();
      await page.setUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      );
      await page.goto(url, { waitUntil: "networkidle2", timeout: 20000 });

      // Wait for the known chord selector per site
      const selectorMap: Record<string, string> = {
        "lacuerda.net": "PRE, pre",
        "cifraclub.com": "pre",
        "ultimate-guitar.com": ".js-store",
      };
      const waitFor = Object.entries(selectorMap).find(([key]) => hostname.includes(key))?.[1];
      if (waitFor) await page.waitForSelector(waitFor, { timeout: 8000 }).catch(() => {});

      const result = extractFromHtml(await page.content(), hostname);
      if (result.rawText) return result;

      return {
        errors: [{
          field: "url",
          message: "Could not extract chord content from this page. Try copying and pasting the text manually.",
        }],
      };
    } catch (err: any) {
      const message = err?.message?.includes("timeout") || cheerioFailed
        ? "Request timed out. The site may be blocking automated requests."
        : "Failed to fetch the page. Please check the URL and try again.";
      return { errors: [{ field: "url", message }] };
    } finally {
      await browser?.close();
    }
  }

  @ValidateUser()
  @Query(() => SongsResponse)
  async getSongs(
    @Ctx() { em, request }: MyContext
  ): Promise<SongsResponse> {
    const req = request as any;

    if (!req.userId) {
      return {
        errors: [{ field: "User", message: "User cannot be found. Please login first." }],
      };
    }

    const songs = await em.find(
      Song,
      { author: req.userId },
      { orderBy: { title: "ASC" } }
    );

    for (const song of songs) {
      await em.populate(song, ["author"]);
    }

    return { results: songs };
  }

  @ValidateUser()
  @Query(() => SongResponse)
  async getSong(
    @Arg("id") id: string,
    @Ctx() { em, request }: MyContext
  ): Promise<SongResponse> {
    const req = request as any;

    if (!req.userId) {
      return {
        errors: [{ field: "User", message: "User cannot be found. Please login first." }],
      };
    }

    const song = await em.findOne(Song, { _id: new ObjectId(id) });

    if (!song) {
      return {
        errors: [{ field: "Song", message: "Song not found" }],
      };
    }

    await em.populate(song, ["author"]);

    return { results: song };
  }

  @ValidateUser()
  @Query(() => SongsResponse)
  async searchSongs(
    @Arg("searchTerm") searchTerm: string,
    @Ctx() { em, request }: MyContext
  ): Promise<SongsResponse> {
    const req = request as any;

    if (!req.userId) {
      return {
        errors: [{ field: "User", message: "User cannot be found. Please login first." }],
      };
    }

    const regex = new RegExp(searchTerm, "i");
    const songs = await em.find(
      Song,
      {
        author: req.userId,
        $or: [
          { title: regex },
          { artist: regex },
        ],
      } as any,
      { orderBy: { title: "ASC" } }
    );

    return { results: songs };
  }

  @ValidateUser()
  @Mutation(() => SongResponse)
  async createSong(
    @Arg("options", () => SongInput) options: SongInput,
    @Ctx() { em, request }: MyContext
  ): Promise<SongResponse> {
    const req = request as any;

    if (!req.userId) {
      return {
        errors: [{ field: "User", message: "User cannot be found. Please login first." }],
      };
    }

    const user = await em.findOne(User, { _id: req.userId });

    if (!user) {
      return {
        errors: [{ field: "User", message: "No user found, try to log in." }],
      };
    }

    const song = em.create(Song, {
      ...options,
      author: user,
    });

    try {
      await em.persistAndFlush(song);
    } catch (err) {
      console.error("Error creating song:", err);
      return {
        errors: [{ field: "Song", message: "Failed to create song" }],
      };
    }

    return { results: song };
  }

  @ValidateUser()
  @Mutation(() => SongResponse)
  async updateSong(
    @Arg("id") id: string,
    @Arg("options", () => SongInput) options: SongInput,
    @Ctx() { em, request }: MyContext
  ): Promise<SongResponse> {
    const req = request as any;

    if (!req.userId) {
      return {
        errors: [{ field: "User", message: "User cannot be found. Please login first." }],
      };
    }

    const song = await em.findOne(Song, { _id: new ObjectId(id) });

    if (!song) {
      return {
        errors: [{ field: "Song", message: "Song not found" }],
      };
    }

    try {
      em.assign(song, options);
      await em.persistAndFlush(song);
      await em.populate(song, ["author"]);
    } catch (err) {
      console.error("Error updating song:", err);
      return {
        errors: [{ field: "Song", message: "Failed to update song" }],
      };
    }

    return { results: song };
  }

  @ValidateUser()
  @Mutation(() => SongResponse)
  async deleteSong(
    @Arg("id") id: string,
    @Ctx() { em, request }: MyContext
  ): Promise<SongResponse> {
    const req = request as any;

    if (!req.userId) {
      return {
        errors: [{ field: "User", message: "User cannot be found. Please login first." }],
      };
    }

    const song = await em.findOne(Song, { _id: new ObjectId(id) });

    if (!song) {
      return {
        errors: [{ field: "Song", message: "Song not found" }],
      };
    }

    try {
      await em.removeAndFlush(song);
    } catch (err) {
      console.error("Error deleting song:", err);
      return {
        errors: [{ field: "Song", message: "Failed to delete song" }],
      };
    }

    return { results: song };
  }
}
