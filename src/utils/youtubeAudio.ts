import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { spawnSync } from "child_process";

/**
 * yt-dlp binary: YT_DLP_PATH env, else ./bin/yt-dlp if present (e.g. Render build), else PATH `yt-dlp`.
 */
export function resolveYtDlpExecutable(): string {
  const env = process.env.YT_DLP_PATH?.trim();
  if (env) {
    return path.isAbsolute(env) ? env : path.join(process.cwd(), env);
  }
  const bundled = path.join(process.cwd(), "bin", "yt-dlp");
  try {
    if (fs.existsSync(bundled)) {
      return bundled;
    }
  } catch {
    /* */
  }
  return "yt-dlp";
}

/** Lazily written from `YT_DLP_COOKIES` inline text (yt-dlp only accepts `--cookies` paths). */
let ytDlpCookiesFromEnvPath: string | null = null;

/** Writable copy of a cookie file path (e.g. Render `/etc/secrets/*` is read-only; yt-dlp saves cookies back). */
let ytDlpCookiesWritableCopyPath: string | null = null;

function resolveCookieFilePath(raw: string): string | null {
  const resolved = path.isAbsolute(raw)
    ? raw
    : path.join(process.cwd(), raw);
  try {
    if (fs.existsSync(resolved)) {
      return resolved;
    }
  } catch {
    /* */
  }
  return null;
}

function getWritableCookiePathFromSourceFile(sourcePath: string): string | null {
  if (ytDlpCookiesWritableCopyPath) {
    return ytDlpCookiesWritableCopyPath;
  }
  try {
    const raw = fs.readFileSync(sourcePath, "utf8");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ytdlp-cookies-"));
    const dest = path.join(dir, "cookies.txt");
    fs.writeFileSync(dest, raw, { encoding: "utf8", mode: 0o600 });
    ytDlpCookiesWritableCopyPath = dest;
    return dest;
  } catch {
    return null;
  }
}

/**
 * Optional Netscape-format cookies for YouTube (`yt-dlp --cookies`).
 *
 * - `YT_DLP_COOKIES_FILE` — path to a cookies file (absolute or relative to cwd).
 *   Read-only mounts (e.g. Render `/etc/secrets/…`) are copied to a temp file so yt-dlp can update cookies.
 * - `YT_DLP_COOKIES` — either the **full Netscape file contents** (multiline secret on Render),
 *   or a single-line path to a file if that path exists (backward compatible).
 *
 * Required on many hosts (e.g. cloud IPs) when YouTube returns "Sign in to confirm you're not a bot".
 * See yt-dlp wiki: exporting YouTube cookies. Do not commit cookie material.
 */
export function getYtDlpCookieCliArgs(): string[] {
  const fileEnv = process.env.YT_DLP_COOKIES_FILE?.trim();
  if (fileEnv) {
    const p = resolveCookieFilePath(fileEnv);
    if (p) {
      const writable = getWritableCookiePathFromSourceFile(p);
      if (writable) {
        return ["--cookies", writable];
      }
    }
  }

  const inlineOrPath = process.env.YT_DLP_COOKIES?.trim();
  if (!inlineOrPath) {
    return [];
  }

  if (!inlineOrPath.includes("\n")) {
    const p = resolveCookieFilePath(inlineOrPath);
    if (p) {
      const writable = getWritableCookiePathFromSourceFile(p);
      if (writable) {
        return ["--cookies", writable];
      }
    }
  }

  if (ytDlpCookiesFromEnvPath) {
    return ["--cookies", ytDlpCookiesFromEnvPath];
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ytdlp-cookies-"));
  const cookiePath = path.join(dir, "cookies.txt");
  fs.writeFileSync(cookiePath, inlineOrPath, { encoding: "utf8", mode: 0o600 });
  ytDlpCookiesFromEnvPath = cookiePath;
  return ["--cookies", cookiePath];
}

let ffmpegVerifiedAvailable = false;
let lastFfmpegNegativeProbeAt = 0;
/** Avoid spawnSync on every ?start= request while ffmpeg is missing. */
const FFMPEG_NEGATIVE_CACHE_MS = 10_000;

/**
 * ffmpeg binary: FFMPEG_PATH env, else ./bin/ffmpeg from ensure-practice-media-deps.cjs, else PATH `ffmpeg`.
 */
export function resolveFfmpegExecutable(): string {
  const env = process.env.FFMPEG_PATH?.trim();
  if (env) {
    return path.isAbsolute(env) ? env : path.join(process.cwd(), env);
  }
  const bundled = path.join(process.cwd(), "bin", "ffmpeg");
  try {
    if (fs.existsSync(bundled)) {
      return bundled;
    }
  } catch {
    /* */
  }
  return "ffmpeg";
}

/**
 * yt-dlp `--download-sections` / `?start=` needs a working ffmpeg (see resolveFfmpegExecutable).
 * - Once true, stays true for the process (no need to re-spawn every request).
 * - While false, re-probes every {@link FFMPEG_NEGATIVE_CACHE_MS} so `./bin/ffmpeg` appears
 *   after `npm run dev` / ensure script without restarting Node.
 */
export function isFfmpegAvailable(): boolean {
  if (ffmpegVerifiedAvailable) {
    return true;
  }
  const now = Date.now();
  if (now - lastFfmpegNegativeProbeAt < FFMPEG_NEGATIVE_CACHE_MS) {
    return false;
  }
  lastFfmpegNegativeProbeAt = now;

  const bin = resolveFfmpegExecutable();
  try {
    const r = spawnSync(bin, ["-hide_banner", "-version"], {
      encoding: "utf8",
      timeout: 5000,
      windowsHide: true,
    });
    if (r.status === 0) {
      ffmpegVerifiedAvailable = true;
      return true;
    }
  } catch {
    /* */
  }
  return false;
}

/**
 * Guess Content-Type from the first bytes of an audio stream (for browser <audio>).
 */
export function detectStreamedAudioMime(initial: Buffer): string {
  if (initial.length >= 8) {
    if (
      initial[4] === 0x66 &&
      initial[5] === 0x74 &&
      initial[6] === 0x79 &&
      initial[7] === 0x70
    ) {
      return "audio/mp4";
    }
  }
  if (
    initial.length >= 4 &&
    initial[0] === 0x1a &&
    initial[1] === 0x45 &&
    initial[2] === 0xdf &&
    initial[3] === 0xa3
  ) {
    return "audio/webm";
  }
  if (
    initial.length >= 2 &&
    initial[0] === 0xff &&
    (initial[1] & 0xf0) === 0xf0
  ) {
    return "audio/aac";
  }
  if (initial.length >= 4 && initial.toString("ascii", 0, 4) === "OggS") {
    return "audio/ogg";
  }
  return "application/octet-stream";
}

/**
 * Extract an 11-character YouTube video id from a raw id or common URL shapes.
 */
export function extractYoutubeVideoId(input: string): string | null {
  const trimmed = decodeURIComponent(input).trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const u = new URL(trimmed);
    if (u.hostname === "youtu.be" || u.hostname === "www.youtu.be") {
      const id = u.pathname.replace(/^\//, "").split("/")[0];
      if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }
    if (
      u.hostname.includes("youtube.com") ||
      u.hostname.includes("youtube-nocookie.com")
    ) {
      const v = u.searchParams.get("v");
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
      const parts = u.pathname.split("/").filter(Boolean);
      const embedIdx = parts.indexOf("embed");
      if (embedIdx >= 0 && parts[embedIdx + 1]) {
        const id = parts[embedIdx + 1];
        if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
      }
    }
  } catch {
    /* not a URL */
  }
  return null;
}

/**
 * yt-dlp `--download-sections` time spec: from `startSec` to end (requires ffmpeg).
 * @see https://github.com/yt-dlp/yt-dlp#download-sections
 */
export function formatYtDlpSectionFromStartSeconds(startSec: number): string {
  const s = Math.max(0, Math.floor(startSec));
  const pad = (n: number) => n.toString().padStart(2, "0");
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `*${h}:${pad(m)}:${pad(sec)}-inf`;
  }
  return `*${m}:${pad(sec)}-inf`;
}

/** Parse `?start=` query: seconds into the track, for seek-by-reload. */
export function parseYoutubeAudioStartQuery(raw: unknown): number {
  if (raw === undefined || raw === null || raw === "") return 0;
  const n = Number.parseFloat(String(raw));
  if (!Number.isFinite(n) || n < 0 || n > 24 * 3600) return 0;
  return n;
}
