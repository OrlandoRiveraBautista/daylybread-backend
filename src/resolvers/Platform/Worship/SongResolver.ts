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
import { RequireAuth } from "../../../middlewares/userAuth";
import { escapeRegExp, omitUndefined } from "../../../utility";
import axios from "axios";
import * as cheerio from "cheerio";
import path from "path";
import puppeteer from "puppeteer";
import {
  assertPublicHostname,
  parseAllowedChordUrl,
} from "../../../utils/safeChordUrl";

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

  }
  // Unknown hosts are rejected before fetch (allowlist in safeChordUrl).

  return {
    rawText: rawText.trim() || undefined,
    title: title || undefined,
    artist: artist || undefined,
    key: key || undefined,
  };
}

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** Sites that return 403 to plain HTTP clients — skip axios and use Puppeteer. */
const BROWSER_ONLY_HOSTS = ["cifraclub.com", "ultimate-guitar.com"];

const CHORD_SELECTOR_BY_HOST: Record<string, string> = {
  "lacuerda.net": "pre",
  "cifraclub.com": "pre",
  "ultimate-guitar.com": ".js-store",
};

function hostNeedsBrowser(hostname: string): boolean {
  return BROWSER_ONLY_HOSTS.some((h) => hostname.includes(h));
}

function chordFetchErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/Could not find Chrome|chrome was not found/i.test(msg)) {
    return process.env.NODE_ENV === "production"
      ? "Chord import is unavailable on the server right now. Use Paste Text, or contact support."
      : "Chord import needs Chromium. From daylybread-backend run: npx puppeteer browsers install chrome — then restart the API.";
  }
  if (/timeout/i.test(msg)) {
    return "Request timed out. The site may be slow or blocking automated requests — try Paste Text instead.";
  }
  if (/403|blocked|denied/i.test(msg)) {
    return "This site blocked the import. Try Paste Text and copy the chords from your browser.";
  }
  return "Failed to fetch the page. Please check the URL and try again.";
}

async function fetchChordsWithBrowser(
  url: string,
  hostname: string
): Promise<{ rawText?: string; title?: string; artist?: string; key?: string }> {
  if (!process.env.PUPPETEER_CACHE_DIR) {
    process.env.PUPPETEER_CACHE_DIR = path.join(process.cwd(), ".cache", "puppeteer");
  }

  const browser = await puppeteer.launch({
    headless: true,
    ...(process.env.PUPPETEER_EXECUTABLE_PATH
      ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH }
      : {}),
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    await page.setUserAgent(BROWSER_USER_AGENT);
    await page.setExtraHTTPHeaders({ "Accept-Language": "es-ES,es;q=0.9,en;q=0.8" });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    const waitFor = Object.entries(CHORD_SELECTOR_BY_HOST).find(([key]) =>
      hostname.includes(key)
    )?.[1];
    if (waitFor) await page.waitForSelector(waitFor, { timeout: 12000 }).catch(() => {});

    return extractFromHtml(await page.content(), hostname);
  } finally {
    await browser.close();
  }
}

@Resolver()
export class SongResolver {
  @RequireAuth()
  @Query(() => FetchChordsResponse)
  async fetchChordsFromUrl(
    @Arg("url") url: string
  ): Promise<FetchChordsResponse> {
    const parsed = parseAllowedChordUrl(url);
    if (!parsed.ok) {
      return { errors: [{ field: "url", message: parsed.message }] };
    }

    const { url: safeUrl, hostname } = parsed;

    try {
      await assertPublicHostname(hostname);
    } catch (err: unknown) {
      return {
        errors: [{
          field: "url",
          message: err instanceof Error ? err.message : "URL target is not allowed.",
        }],
      };
    }

    // ── Step 1: fast cheerio path (skipped for bot-blocked hosts) ──
    if (!hostNeedsBrowser(hostname)) {
      try {
        const response = await axios.get(safeUrl, {
          headers: {
            "User-Agent": BROWSER_USER_AGENT,
            "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            Referer: "https://www.google.com/",
          },
          timeout: 12000,
          maxRedirects: 3,
          // beforeRedirect is sync in axios — re-check allowlist on each hop.
          beforeRedirect: (options) => {
            const next =
              typeof (options as { href?: string }).href === "string"
                ? (options as { href: string }).href
                : typeof options.url === "string"
                  ? options.url
                  : "";
            if (!next) throw new Error("Redirect without URL is not allowed.");
            const redirected = parseAllowedChordUrl(next);
            if (!redirected.ok) throw new Error(redirected.message);
          },
          validateStatus: (status) => status < 500,
        });
        if (response.status >= 400) {
          throw new Error(`HTTP ${response.status}`);
        }
        const result = extractFromHtml(response.data, hostname);
        if (result.rawText) return result;
      } catch (err) {
        // Allowlisted host but blocked/empty — fall through to Puppeteer.
        // Do not fall through on allowlist/SSRF failures from redirects.
        const msg = err instanceof Error ? err.message : "";
        if (/not allowed|not supported|Only HTTPS|credentials/i.test(msg)) {
          return { errors: [{ field: "url", message: msg }] };
        }
      }
    }

    // ── Step 2: Puppeteer (required for CifraClub / UG; fallback for allowlisted hosts) ──
    try {
      const result = await fetchChordsWithBrowser(safeUrl, hostname);
      if (result.rawText) return result;

      return {
        errors: [{
          field: "url",
          message:
            "Could not extract chord content from this page. Try copying and pasting the text manually.",
        }],
      };
    } catch (err: unknown) {
      return { errors: [{ field: "url", message: chordFetchErrorMessage(err) }] };
    }
  }

  @Query(() => SongsResponse)
  async getSongs(
    @Ctx() { em }: MyContext
  ): Promise<SongsResponse> {
    const songs = await em.find(
      Song,
      {},
      { orderBy: { title: "ASC" } }
    );

    for (const song of songs) {
      await em.populate(song, ["author"]);
    }

    return { results: songs };
  }

  @Query(() => SongResponse)
  async getSong(
    @Arg("id") id: string,
    @Ctx() { em }: MyContext
  ): Promise<SongResponse> {
    const song = await em.findOne(Song, { _id: new ObjectId(id) });

    if (!song) {
      return {
        errors: [{ field: "Song", message: "Song not found" }],
      };
    }

    await em.populate(song, ["author"]);

    return { results: song };
  }

  @Query(() => SongsResponse)
  async searchSongs(
    @Arg("searchTerm") searchTerm: string,
    @Ctx() { em }: MyContext
  ): Promise<SongsResponse> {
    const regex = new RegExp(escapeRegExp(searchTerm), "i");
    const songs = await em.find(
      Song,
      {
        $or: [
          { title: regex },
          { artist: regex },
        ],
      } as any,
      { orderBy: { title: "ASC" } }
    );

    return { results: songs };
  }

  @RequireAuth()
  @Mutation(() => SongResponse)
  async createSong(
    @Arg("options", () => SongInput) options: SongInput,
    @Ctx() { em, request }: MyContext
  ): Promise<SongResponse> {
    const req = request as any;

    const user = await em.findOne(User, { _id: req.userId });

    if (!user) {
      return {
        errors: [{ field: "User", message: "No user found, try to log in." }],
      };
    }

    const song = em.create(Song, {
      ...(omitUndefined({ ...options }) as SongInput),
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

  @RequireAuth()
  @Mutation(() => SongResponse)
  async updateSong(
    @Arg("id") id: string,
    @Arg("options", () => SongInput) options: SongInput,
    @Ctx() { em }: MyContext
  ): Promise<SongResponse> {

    const song = await em.findOne(Song, { _id: new ObjectId(id) });

    if (!song) {
      return {
        errors: [{ field: "Song", message: "Song not found" }],
      };
    }

    await em.populate(song, ["author"]);

    // Any authenticated user may update songs (shared library / collaboration).

    try {
      em.assign(song, omitUndefined({ ...options }));
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

  @RequireAuth()
  @Mutation(() => SongResponse)
  async deleteSong(
    @Arg("id") id: string,
    @Ctx() { em, request }: MyContext
  ): Promise<SongResponse> {
    const req = request as any;

    const song = await em.findOne(Song, { _id: new ObjectId(id) });

    if (!song) {
      return {
        errors: [{ field: "Song", message: "Song not found" }],
      };
    }

    await em.populate(song, ["author"]);

    if (song.author._id.toString() !== req.userId.toString()) {
      return {
        errors: [{ field: "Song", message: "You can only delete songs you created." }],
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
