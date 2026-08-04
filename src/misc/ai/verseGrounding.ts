import { EntityManager } from "@mikro-orm/mongodb";
import { Verse } from "../../entities/Bible/Verse";
import { getBibleBrainService } from "../../services/BibleBrainService";
import { bibleBrainCache } from "../biblebrain/ttlCache";
import { bibleBrainGet } from "../biblebrain/client";

export type ParsedVerseRef = {
  bookId: string;
  bookName: string;
  chapter: number;
  verseStart: number;
  verseEnd?: number;
  reference: string;
};

export type GroundedVerse = ParsedVerseRef & {
  verseText: string;
  source: "local" | "biblebrain";
};

/** Common display names / aliases → USFM-style book ids used by DBP. */
const BOOK_ALIASES: Record<string, { bookId: string; bookName: string }> = {
  genesis: { bookId: "GEN", bookName: "Genesis" },
  gen: { bookId: "GEN", bookName: "Genesis" },
  exodus: { bookId: "EXO", bookName: "Exodus" },
  exo: { bookId: "EXO", bookName: "Exodus" },
  exod: { bookId: "EXO", bookName: "Exodus" },
  leviticus: { bookId: "LEV", bookName: "Leviticus" },
  lev: { bookId: "LEV", bookName: "Leviticus" },
  numbers: { bookId: "NUM", bookName: "Numbers" },
  num: { bookId: "NUM", bookName: "Numbers" },
  deuteronomy: { bookId: "DEU", bookName: "Deuteronomy" },
  deut: { bookId: "DEU", bookName: "Deuteronomy" },
  deu: { bookId: "DEU", bookName: "Deuteronomy" },
  joshua: { bookId: "JOS", bookName: "Joshua" },
  jos: { bookId: "JOS", bookName: "Joshua" },
  judges: { bookId: "JDG", bookName: "Judges" },
  jdg: { bookId: "JDG", bookName: "Judges" },
  ruth: { bookId: "RUT", bookName: "Ruth" },
  rut: { bookId: "RUT", bookName: "Ruth" },
  "1 samuel": { bookId: "1SA", bookName: "1 Samuel" },
  "1samuel": { bookId: "1SA", bookName: "1 Samuel" },
  "1sa": { bookId: "1SA", bookName: "1 Samuel" },
  "2 samuel": { bookId: "2SA", bookName: "2 Samuel" },
  "2samuel": { bookId: "2SA", bookName: "2 Samuel" },
  "2sa": { bookId: "2SA", bookName: "2 Samuel" },
  "1 kings": { bookId: "1KI", bookName: "1 Kings" },
  "1kings": { bookId: "1KI", bookName: "1 Kings" },
  "1ki": { bookId: "1KI", bookName: "1 Kings" },
  "2 kings": { bookId: "2KI", bookName: "2 Kings" },
  "2kings": { bookId: "2KI", bookName: "2 Kings" },
  "2ki": { bookId: "2KI", bookName: "2 Kings" },
  "1 chronicles": { bookId: "1CH", bookName: "1 Chronicles" },
  "1chronicles": { bookId: "1CH", bookName: "1 Chronicles" },
  "1ch": { bookId: "1CH", bookName: "1 Chronicles" },
  "2 chronicles": { bookId: "2CH", bookName: "2 Chronicles" },
  "2chronicles": { bookId: "2CH", bookName: "2 Chronicles" },
  "2ch": { bookId: "2CH", bookName: "2 Chronicles" },
  ezra: { bookId: "EZR", bookName: "Ezra" },
  ezr: { bookId: "EZR", bookName: "Ezra" },
  nehemiah: { bookId: "NEH", bookName: "Nehemiah" },
  neh: { bookId: "NEH", bookName: "Nehemiah" },
  esther: { bookId: "EST", bookName: "Esther" },
  est: { bookId: "EST", bookName: "Esther" },
  job: { bookId: "JOB", bookName: "Job" },
  psalms: { bookId: "PSA", bookName: "Psalms" },
  psalm: { bookId: "PSA", bookName: "Psalms" },
  psa: { bookId: "PSA", bookName: "Psalms" },
  ps: { bookId: "PSA", bookName: "Psalms" },
  proverbs: { bookId: "PRO", bookName: "Proverbs" },
  prov: { bookId: "PRO", bookName: "Proverbs" },
  pro: { bookId: "PRO", bookName: "Proverbs" },
  ecclesiastes: { bookId: "ECC", bookName: "Ecclesiastes" },
  ecc: { bookId: "ECC", bookName: "Ecclesiastes" },
  "song of solomon": { bookId: "SNG", bookName: "Song of Solomon" },
  "song of songs": { bookId: "SNG", bookName: "Song of Solomon" },
  songs: { bookId: "SNG", bookName: "Song of Solomon" },
  sng: { bookId: "SNG", bookName: "Song of Solomon" },
  isaiah: { bookId: "ISA", bookName: "Isaiah" },
  isa: { bookId: "ISA", bookName: "Isaiah" },
  jeremiah: { bookId: "JER", bookName: "Jeremiah" },
  jer: { bookId: "JER", bookName: "Jeremiah" },
  lamentations: { bookId: "LAM", bookName: "Lamentations" },
  lam: { bookId: "LAM", bookName: "Lamentations" },
  ezekiel: { bookId: "EZK", bookName: "Ezekiel" },
  ezk: { bookId: "EZK", bookName: "Ezekiel" },
  eze: { bookId: "EZK", bookName: "Ezekiel" },
  daniel: { bookId: "DAN", bookName: "Daniel" },
  dan: { bookId: "DAN", bookName: "Daniel" },
  hosea: { bookId: "HOS", bookName: "Hosea" },
  hos: { bookId: "HOS", bookName: "Hosea" },
  joel: { bookId: "JOL", bookName: "Joel" },
  jol: { bookId: "JOL", bookName: "Joel" },
  amos: { bookId: "AMO", bookName: "Amos" },
  amo: { bookId: "AMO", bookName: "Amos" },
  obadiah: { bookId: "OBA", bookName: "Obadiah" },
  oba: { bookId: "OBA", bookName: "Obadiah" },
  jonah: { bookId: "JON", bookName: "Jonah" },
  jon: { bookId: "JON", bookName: "Jonah" },
  micah: { bookId: "MIC", bookName: "Micah" },
  mic: { bookId: "MIC", bookName: "Micah" },
  nahum: { bookId: "NAM", bookName: "Nahum" },
  nam: { bookId: "NAM", bookName: "Nahum" },
  nah: { bookId: "NAM", bookName: "Nahum" },
  habakkuk: { bookId: "HAB", bookName: "Habakkuk" },
  hab: { bookId: "HAB", bookName: "Habakkuk" },
  zephaniah: { bookId: "ZEP", bookName: "Zephaniah" },
  zep: { bookId: "ZEP", bookName: "Zephaniah" },
  haggai: { bookId: "HAG", bookName: "Haggai" },
  hag: { bookId: "HAG", bookName: "Haggai" },
  zechariah: { bookId: "ZEC", bookName: "Zechariah" },
  zec: { bookId: "ZEC", bookName: "Zechariah" },
  malachi: { bookId: "MAL", bookName: "Malachi" },
  mal: { bookId: "MAL", bookName: "Malachi" },
  matthew: { bookId: "MAT", bookName: "Matthew" },
  matt: { bookId: "MAT", bookName: "Matthew" },
  mat: { bookId: "MAT", bookName: "Matthew" },
  mt: { bookId: "MAT", bookName: "Matthew" },
  mark: { bookId: "MRK", bookName: "Mark" },
  mrk: { bookId: "MRK", bookName: "Mark" },
  mk: { bookId: "MRK", bookName: "Mark" },
  luke: { bookId: "LUK", bookName: "Luke" },
  luk: { bookId: "LUK", bookName: "Luke" },
  lk: { bookId: "LUK", bookName: "Luke" },
  john: { bookId: "JHN", bookName: "John" },
  jhn: { bookId: "JHN", bookName: "John" },
  jn: { bookId: "JHN", bookName: "John" },
  acts: { bookId: "ACT", bookName: "Acts" },
  act: { bookId: "ACT", bookName: "Acts" },
  romans: { bookId: "ROM", bookName: "Romans" },
  rom: { bookId: "ROM", bookName: "Romans" },
  "1 corinthians": { bookId: "1CO", bookName: "1 Corinthians" },
  "1corinthians": { bookId: "1CO", bookName: "1 Corinthians" },
  "1cor": { bookId: "1CO", bookName: "1 Corinthians" },
  "1co": { bookId: "1CO", bookName: "1 Corinthians" },
  "2 corinthians": { bookId: "2CO", bookName: "2 Corinthians" },
  "2corinthians": { bookId: "2CO", bookName: "2 Corinthians" },
  "2cor": { bookId: "2CO", bookName: "2 Corinthians" },
  "2co": { bookId: "2CO", bookName: "2 Corinthians" },
  galatians: { bookId: "GAL", bookName: "Galatians" },
  gal: { bookId: "GAL", bookName: "Galatians" },
  ephesians: { bookId: "EPH", bookName: "Ephesians" },
  eph: { bookId: "EPH", bookName: "Ephesians" },
  philippians: { bookId: "PHP", bookName: "Philippians" },
  phil: { bookId: "PHP", bookName: "Philippians" },
  php: { bookId: "PHP", bookName: "Philippians" },
  colossians: { bookId: "COL", bookName: "Colossians" },
  col: { bookId: "COL", bookName: "Colossians" },
  "1 thessalonians": { bookId: "1TH", bookName: "1 Thessalonians" },
  "1thessalonians": { bookId: "1TH", bookName: "1 Thessalonians" },
  "1thess": { bookId: "1TH", bookName: "1 Thessalonians" },
  "1th": { bookId: "1TH", bookName: "1 Thessalonians" },
  "2 thessalonians": { bookId: "2TH", bookName: "2 Thessalonians" },
  "2thessalonians": { bookId: "2TH", bookName: "2 Thessalonians" },
  "2thess": { bookId: "2TH", bookName: "2 Thessalonians" },
  "2th": { bookId: "2TH", bookName: "2 Thessalonians" },
  "1 timothy": { bookId: "1TI", bookName: "1 Timothy" },
  "1timothy": { bookId: "1TI", bookName: "1 Timothy" },
  "1tim": { bookId: "1TI", bookName: "1 Timothy" },
  "1ti": { bookId: "1TI", bookName: "1 Timothy" },
  "2 timothy": { bookId: "2TI", bookName: "2 Timothy" },
  "2timothy": { bookId: "2TI", bookName: "2 Timothy" },
  "2tim": { bookId: "2TI", bookName: "2 Timothy" },
  "2ti": { bookId: "2TI", bookName: "2 Timothy" },
  titus: { bookId: "TIT", bookName: "Titus" },
  tit: { bookId: "TIT", bookName: "Titus" },
  philemon: { bookId: "PHM", bookName: "Philemon" },
  phm: { bookId: "PHM", bookName: "Philemon" },
  hebrews: { bookId: "HEB", bookName: "Hebrews" },
  heb: { bookId: "HEB", bookName: "Hebrews" },
  james: { bookId: "JAS", bookName: "James" },
  jas: { bookId: "JAS", bookName: "James" },
  "1 peter": { bookId: "1PE", bookName: "1 Peter" },
  "1peter": { bookId: "1PE", bookName: "1 Peter" },
  "1pet": { bookId: "1PE", bookName: "1 Peter" },
  "1pe": { bookId: "1PE", bookName: "1 Peter" },
  "2 peter": { bookId: "2PE", bookName: "2 Peter" },
  "2peter": { bookId: "2PE", bookName: "2 Peter" },
  "2pet": { bookId: "2PE", bookName: "2 Peter" },
  "2pe": { bookId: "2PE", bookName: "2 Peter" },
  "1 john": { bookId: "1JN", bookName: "1 John" },
  "1john": { bookId: "1JN", bookName: "1 John" },
  "1jn": { bookId: "1JN", bookName: "1 John" },
  "2 john": { bookId: "2JN", bookName: "2 John" },
  "2john": { bookId: "2JN", bookName: "2 John" },
  "2jn": { bookId: "2JN", bookName: "2 John" },
  "3 john": { bookId: "3JN", bookName: "3 John" },
  "3john": { bookId: "3JN", bookName: "3 John" },
  "3jn": { bookId: "3JN", bookName: "3 John" },
  jude: { bookId: "JUD", bookName: "Jude" },
  jud: { bookId: "JUD", bookName: "Jude" },
  revelation: { bookId: "REV", bookName: "Revelation" },
  rev: { bookId: "REV", bookName: "Revelation" },
};

const REF_PATTERN =
  /^((?:[1-3]\s*)?[A-Za-z]+(?:\s+[A-Za-z]+)?)\s+(\d+)\s*:\s*(\d+)(?:\s*-\s*(\d+))?$/;

export function parseVerseReference(input: {
  bookId?: string;
  bookName?: string;
  chapter?: number;
  verseStart?: number;
  verseEnd?: number;
  reference?: string;
}): ParsedVerseRef | null {
  if (
    input.bookId &&
    input.chapter &&
    input.verseStart
  ) {
    const alias =
      BOOK_ALIASES[input.bookId.toLowerCase()] ||
      BOOK_ALIASES[(input.bookName || "").toLowerCase()];
    const bookId = (alias?.bookId || input.bookId).toUpperCase();
    const bookName = alias?.bookName || input.bookName || bookId;
    const verseEnd = input.verseEnd && input.verseEnd > input.verseStart
      ? input.verseEnd
      : undefined;
    return {
      bookId,
      bookName,
      chapter: input.chapter,
      verseStart: input.verseStart,
      verseEnd,
      reference: formatReference(bookName, input.chapter, input.verseStart, verseEnd),
    };
  }

  if (!input.reference) return null;
  const trimmed = input.reference.trim();
  const match = trimmed.match(REF_PATTERN);
  if (!match) return null;

  const bookKey = match[1].replace(/\s+/g, " ").toLowerCase();
  const alias = BOOK_ALIASES[bookKey] || BOOK_ALIASES[bookKey.replace(/\s/g, "")];
  if (!alias) return null;

  const chapter = Number(match[2]);
  const verseStart = Number(match[3]);
  const verseEnd = match[4] ? Number(match[4]) : undefined;
  return {
    bookId: alias.bookId,
    bookName: alias.bookName,
    chapter,
    verseStart,
    verseEnd:
      verseEnd && verseEnd > verseStart ? verseEnd : undefined,
    reference: formatReference(
      alias.bookName,
      chapter,
      verseStart,
      verseEnd && verseEnd > verseStart ? verseEnd : undefined
    ),
  };
}

function formatReference(
  bookName: string,
  chapter: number,
  verseStart: number,
  verseEnd?: number
): string {
  return verseEnd
    ? `${bookName} ${chapter}:${verseStart}-${verseEnd}`
    : `${bookName} ${chapter}:${verseStart}`;
}

type FilesetLike = {
  id?: string;
  type?: string;
  set_type_code?: string;
  setTypeCode?: string;
};

function pickTextFilesetId(filesets: unknown): string | null {
  if (!filesets) return null;

  const candidates: FilesetLike[] = [];

  if (Array.isArray(filesets)) {
    candidates.push(...(filesets as FilesetLike[]));
  } else if (typeof filesets === "object") {
    for (const value of Object.values(filesets as Record<string, unknown>)) {
      if (Array.isArray(value)) {
        candidates.push(...(value as FilesetLike[]));
      } else if (value && typeof value === "object") {
        candidates.push(value as FilesetLike);
      } else if (typeof value === "string" && /text/i.test(value)) {
        return value;
      }
    }
  }

  const textPlain = candidates.find((f) => {
    const type = (f.type || f.set_type_code || f.setTypeCode || "").toLowerCase();
    return type.includes("text_plain") || type === "text";
  });
  if (textPlain?.id) return textPlain.id;

  const anyText = candidates.find((f) => {
    const type = (f.type || f.set_type_code || f.setTypeCode || "").toLowerCase();
    return type.includes("text");
  });
  return anyText?.id || null;
}

async function resolveTextFilesetId(bibleVersion: string): Promise<string | null> {
  const abbr = bibleVersion.trim().toUpperCase();
  const cacheKey = `ai:fileset:${abbr}`;

  return bibleBrainCache.getOrSet(cacheKey, 24 * 60 * 60 * 1000, async () => {
    const service = getBibleBrainService();
    const search = await service.searchAvailableBibles(abbr, 1);
    const match =
      (search.data || []).find(
        (b) => (b.abbr || "").toUpperCase() === abbr
      ) || (search.data || [])[0];

    if (!match?.abbr) return null;

    // Prefer detail endpoint for full fileset metadata.
    try {
      const detail = await bibleBrainGet<Record<string, unknown>>(
        `/api/bibles/${encodeURIComponent(match.abbr)}`
      );
      const fromDetail = pickTextFilesetId(
        (detail as { data?: { filesets?: unknown } }).data?.filesets ??
          (detail as { filesets?: unknown }).filesets
      );
      if (fromDetail) return fromDetail;
    } catch {
      // fall through to list payload filesets
    }

    return pickTextFilesetId(match.filesets);
  });
}

async function fetchFromLocal(
  em: EntityManager,
  parsed: ParsedVerseRef,
  bibleVersion: string
): Promise<GroundedVerse | null> {
  const candidates = await em.find(
    Verse,
    {
      chapterNumber: String(parsed.chapter),
      verse: String(parsed.verseStart),
    },
    { limit: 25 }
  );

  const version = bibleVersion.toLowerCase();
  const match =
    candidates.find(
      (v) =>
        v.bookName?.toLowerCase() === parsed.bookName.toLowerCase() &&
        (v.bibleId?.toLowerCase().includes(version) ||
          (v.translation as { abbreviation?: string } | undefined)?.abbreviation
            ?.toLowerCase()
            .includes(version))
    ) ||
    candidates.find(
      (v) => v.bookName?.toLowerCase() === parsed.bookName.toLowerCase()
    );

  if (!match?.text) return null;

  return {
    ...parsed,
    verseText: match.text.trim(),
    source: "local",
  };
}

async function fetchFromBibleBrain(
  parsed: ParsedVerseRef,
  bibleVersion: string
): Promise<GroundedVerse | null> {
  const filesetId = await resolveTextFilesetId(bibleVersion);
  if (!filesetId) return null;

  const service = getBibleBrainService();
  const chapter = await service.getAvailableVerse(
    filesetId,
    parsed.bookId,
    parsed.chapter
  );

  const verses = chapter.data || [];
  const end = parsed.verseEnd || parsed.verseStart;
  const matched = verses.filter((v) => {
    const start = v.verseStart ?? 0;
    return start >= parsed.verseStart && start <= end;
  });

  if (!matched.length) return null;

  const verseText = matched
    .map((v) => (v.verseText || "").trim())
    .filter(Boolean)
    .join(" ")
    .trim();

  if (!verseText) return null;

  return {
    ...parsed,
    verseText,
    source: "biblebrain",
  };
}

/**
 * Resolve canonical verse text from local DB or Bible Brain for a reference.
 */
export async function groundVerseText(
  em: EntityManager,
  input: {
    bookId?: string;
    bookName?: string;
    chapter?: number;
    verseStart?: number;
    verseEnd?: number;
    reference?: string;
  },
  bibleVersion = "NIV"
): Promise<GroundedVerse | null> {
  const parsed = parseVerseReference(input);
  if (!parsed) return null;

  try {
    const local = await fetchFromLocal(em, parsed, bibleVersion);
    if (local) return local;
  } catch (error) {
    console.warn("Local verse grounding failed:", error);
  }

  try {
    return await fetchFromBibleBrain(parsed, bibleVersion);
  } catch (error) {
    console.warn("BibleBrain verse grounding failed:", error);
    return null;
  }
}
