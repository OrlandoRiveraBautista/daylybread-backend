#!/usr/bin/env node
/**
 * Ensures binaries for the YouTube audio proxy (Worship Practice mode):
 *
 * 1) yt-dlp — used to stream audio. Checks YT_DLP_PATH, PATH, ./bin/yt-dlp;
 *    otherwise downloads the official release into ./bin/yt-dlp (macOS / Linux).
 *
 * 2) ffmpeg — required for ?start= / seek past the browser buffer (yt-dlp
 *    --download-sections). Checks FFMPEG_PATH, PATH, ./bin/ffmpeg; otherwise
 *    downloads a static build (macOS: evermeet.cx release zip — Intel binary, runs on Apple Silicon via Rosetta; Linux: johnvansickle tar.xz).
 *
 * Windows: install yt-dlp / ffmpeg yourself or set YT_DLP_PATH / FFMPEG_PATH.
 *
 * Failures are soft by default: Practice YouTube audio may be unavailable, but
 * `npm run dev` / `compile` still continue so the rest of the API can start.
 *
 * Env:
 *   SKIP_PRACTICE_MEDIA_DOWNLOAD=1 — do not download anything (only verify existing).
 *   SKIP_FFMPEG_DOWNLOAD=1        — do not download ffmpeg (yt-dlp may still download).
 *   REQUIRE_PRACTICE_MEDIA_DEPS=1 — exit non-zero on failure (CI / deploys that need Practice).
 */

const { spawnSync } = require("child_process");
const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");
const { URL } = require("url");

const ROOT = path.resolve(__dirname, "..");
const BIN_DIR = path.join(ROOT, "bin");
const BIN_YTDLP = path.join(BIN_DIR, "yt-dlp");
const BIN_FFMPEG = path.join(BIN_DIR, "ffmpeg");

const YTDLP_RELEASE_BASE =
  "https://github.com/yt-dlp/yt-dlp/releases/latest/download/";

/**
 * macOS static ffmpeg (evermeet.cx download API).
 * @see https://evermeet.cx/ffmpeg/ — use getrelease/zip (not …/ffmpeg/zip — that 404s).
 * Same Intel build for all Macs; Apple Silicon runs it under Rosetta (evermeet provides no ARM zip).
 */
const FFMPEG_MAC_ZIP_URL = "https://evermeet.cx/ffmpeg/getrelease/zip";

/** Linux static ffmpeg (johnvansickle.com) */
const FFMPEG_LINUX_TAR = {
  x64: "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz",
  arm64: "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-arm64-static.tar.xz",
};

function skipAllDownloads() {
  return process.env.SKIP_PRACTICE_MEDIA_DOWNLOAD === "1";
}

function skipFfmpegDownload() {
  return (
    skipAllDownloads() || process.env.SKIP_FFMPEG_DOWNLOAD === "1"
  );
}

function requirePracticeMediaDeps() {
  return process.env.REQUIRE_PRACTICE_MEDIA_DEPS === "1";
}

/** Soft-fail unless REQUIRE_PRACTICE_MEDIA_DEPS=1. */
function reportOptionalFailure(message) {
  console.error(`[practice-media-deps] ${message}`);
  console.error(
    "[practice-media-deps] continuing without Practice media deps (Worship Practice audio may fail). Set REQUIRE_PRACTICE_MEDIA_DEPS=1 to make this fatal.",
  );
  if (requirePracticeMediaDeps()) {
    process.exitCode = 1;
  }
}

/**
 * PyInstaller yt-dlp_macos often spends ~20s in wait4 on cold start (macOS
 * Gatekeeper / onefile extract). Keep headroom so the ensure step does not
 * false-fail right at the old 20s cutoff.
 */
const VERSION_CHECK_TIMEOUT_MS = 90000;

function works(exe, args) {
  const r = spawnSync(exe, args, {
    encoding: "utf8",
    timeout: VERSION_CHECK_TIMEOUT_MS,
    env: process.env,
    windowsHide: true,
  });
  return r.status === 0;
}

/** @returns {{ ok: boolean, detail?: string }} */
function worksDetailed(exe, args) {
  const r = spawnSync(exe, args, {
    encoding: "utf8",
    timeout: VERSION_CHECK_TIMEOUT_MS,
    env: process.env,
    windowsHide: true,
  });
  if (r.status === 0) return { ok: true };
  if (r.error) {
    return { ok: false, detail: String(r.error.message || r.error) };
  }
  if (r.signal) {
    return { ok: false, detail: `killed by ${r.signal}` };
  }
  const err = (r.stderr || "").trim();
  return {
    ok: false,
    detail: err
      ? `exit ${r.status}: ${err.slice(0, 300)}`
      : `exit ${r.status}`,
  };
}

function ytDlpWorks(exe) {
  return works(exe, ["--version"]);
}

function ffmpegWorks(exe) {
  return works(exe, ["-hide_banner", "-version"]);
}

function tryPath(p, checker) {
  if (!p || typeof p !== "string") return false;
  const trimmed = p.trim();
  if (!trimmed) return false;
  const abs = path.isAbsolute(trimmed) ? trimmed : path.join(ROOT, trimmed);
  try {
    if (!fs.existsSync(abs)) return false;
  } catch {
    return false;
  }
  try {
    fs.accessSync(abs, fs.constants.X_OK);
  } catch {
    /* Windows may not support X_OK the same way */
  }
  return checker(abs);
}

function clearMacosQuarantine(file) {
  if (process.platform !== "darwin") return;
  spawnSync("xattr", ["-cr", file], { stdio: "ignore" });
}

/**
 * Follow redirects until a 200 body.
 * @param {string} currentUrl
 * @param {string} destTmp
 * @param {number} redirectCount
 */
function downloadFollowRedirects(currentUrl, destTmp, redirectCount = 0) {
  const maxRedirects = 25;
  if (redirectCount > maxRedirects) {
    return Promise.reject(new Error("Too many redirects"));
  }
  return new Promise((resolve, reject) => {
    let u;
    try {
      u = new URL(currentUrl);
    } catch (e) {
      reject(e);
      return;
    }
    const lib = u.protocol === "http:" ? http : https;
    const req = lib.get(
      currentUrl,
      {
        headers: { "User-Agent": "daylybread-backend/ensure-practice-media-deps" },
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          let next;
          try {
            next = new URL(res.headers.location, currentUrl).href;
          } catch (err) {
            res.resume();
            reject(err);
            return;
          }
          res.resume();
          downloadFollowRedirects(next, destTmp, redirectCount + 1)
            .then(resolve)
            .catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`Download HTTP ${res.statusCode}`));
          return;
        }
        const file = fs.createWriteStream(destTmp);
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve()));
        res.on("error", reject);
      },
    );
    req.on("error", reject);
  });
}

function ytdlpReleaseAssetFilename() {
  if (process.platform === "darwin") {
    return "yt-dlp_macos";
  }
  if (process.platform === "linux") {
    return process.arch === "arm64"
      ? "yt-dlp_linux_aarch64"
      : "yt-dlp_linux";
  }
  return null;
}

/** @param {string} assetFile e.g. yt-dlp_macos */
function downloadYtDlpAsset(assetFile) {
  const startUrl = `${YTDLP_RELEASE_BASE}${assetFile}`;
  fs.mkdirSync(path.dirname(BIN_YTDLP), { recursive: true });
  const tmp = `${BIN_YTDLP}.tmp`;
  try {
    fs.unlinkSync(tmp);
  } catch {
    /* */
  }
  return downloadFollowRedirects(startUrl, tmp).then(() => {
    fs.renameSync(tmp, BIN_YTDLP);
    fs.chmodSync(BIN_YTDLP, 0o755);
    clearMacosQuarantine(BIN_YTDLP);
  });
}

async function ensureYtDlp() {
  const log = (m) => process.stderr.write(`[practice-media-deps] ${m}\n`);

  if (tryPath(process.env.YT_DLP_PATH, ytDlpWorks)) {
    return;
  }
  if (ytDlpWorks("yt-dlp")) {
    return;
  }
  if (tryPath(BIN_YTDLP, ytDlpWorks)) {
    return;
  }

  if (skipAllDownloads()) {
    reportOptionalFailure(
      "yt-dlp not found; set SKIP_PRACTICE_MEDIA_DOWNLOAD=0 to auto-download, or install yt-dlp / YT_DLP_PATH.",
    );
    return;
  }

  const asset = ytdlpReleaseAssetFilename();
  if (!asset) {
    reportOptionalFailure(
      "yt-dlp not found. On Windows install via pip/scoop or set YT_DLP_PATH.",
    );
    return;
  }

  log(`downloading yt-dlp (${asset})…`);
  try {
    await downloadYtDlpAsset(asset);
  } catch (e) {
    reportOptionalFailure(`yt-dlp download failed: ${e.message || e}`);
    return;
  }
  const check = worksDetailed(BIN_YTDLP, ["--version"]);
  if (!check.ok) {
    reportOptionalFailure(
      `yt-dlp binary did not run${check.detail ? ` (${check.detail})` : ""}. tip: first launch of yt-dlp_macos can take >20s on macOS; or install via brew and ensure yt-dlp is on PATH.`,
    );
  } else {
    log("installed ./bin/yt-dlp");
  }
}

/**
 * Find a file named `ffmpeg` under `dir` (depth-first).
 * @param {string} dir
 * @returns {string | null}
 */
function findFfmpegBinary(dir) {
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    return null;
  }
  for (const name of names) {
    if (name === "." || name === "..") continue;
    const p = path.join(dir, name);
    let st;
    try {
      st = fs.statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      const inner = findFfmpegBinary(p);
      if (inner) return inner;
    } else if (name === "ffmpeg" && st.isFile()) {
      return p;
    }
  }
  return null;
}

function unzipMacFfmpeg(zipPath) {
  const tmp = path.join(ROOT, ".ffmpeg-unzip-tmp");
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {
    /* */
  }
  fs.mkdirSync(tmp, { recursive: true });

  let r = spawnSync("unzip", ["-o", "-q", zipPath, "-d", tmp], {
    encoding: "utf8",
    timeout: 120000,
    env: process.env,
  });
  if (r.status !== 0) {
    return false;
  }

  const found = findFfmpegBinary(tmp);
  if (!found) {
    fs.rmSync(tmp, { recursive: true, force: true });
    return false;
  }

  try {
    fs.unlinkSync(BIN_FFMPEG);
  } catch {
    /* */
  }
  fs.copyFileSync(found, BIN_FFMPEG);
  fs.chmodSync(BIN_FFMPEG, 0o755);
  clearMacosQuarantine(BIN_FFMPEG);
  fs.rmSync(tmp, { recursive: true, force: true });
  return true;
}

function extractLinuxFfmpeg(tarXzPath) {
  const tmp = path.join(ROOT, ".ffmpeg-tar-tmp");
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {
    /* */
  }
  fs.mkdirSync(tmp, { recursive: true });

  const r = spawnSync("tar", ["-xJf", tarXzPath, "-C", tmp], {
    encoding: "utf8",
    timeout: 300000,
    env: process.env,
  });
  if (r.status !== 0) {
    fs.rmSync(tmp, { recursive: true, force: true });
    return false;
  }

  const found = findFfmpegBinary(tmp);
  if (!found) {
    fs.rmSync(tmp, { recursive: true, force: true });
    return false;
  }

  try {
    fs.unlinkSync(BIN_FFMPEG);
  } catch {
    /* */
  }
  fs.copyFileSync(found, BIN_FFMPEG);
  fs.chmodSync(BIN_FFMPEG, 0o755);
  fs.rmSync(tmp, { recursive: true, force: true });
  return true;
}

async function downloadMacFfmpeg() {
  fs.mkdirSync(BIN_DIR, { recursive: true });
  const tmpZip = `${BIN_FFMPEG}.zip.tmp`;
  try {
    fs.unlinkSync(tmpZip);
  } catch {
    /* */
  }
  await downloadFollowRedirects(FFMPEG_MAC_ZIP_URL, tmpZip);
  if (!unzipMacFfmpeg(tmpZip)) {
    try {
      fs.unlinkSync(tmpZip);
    } catch {
      /* */
    }
    throw new Error("unzip/extract failed (is unzip installed?)");
  }
  try {
    fs.unlinkSync(tmpZip);
  } catch {
    /* */
  }
}

async function downloadLinuxFfmpeg() {
  const key = process.arch === "arm64" ? "arm64" : "x64";
  const url = FFMPEG_LINUX_TAR[key];
  if (!url) {
    throw new Error(`unsupported Linux arch: ${process.arch}`);
  }
  fs.mkdirSync(BIN_DIR, { recursive: true });
  const tmpTar = `${BIN_FFMPEG}.tar.xz.tmp`;
  try {
    fs.unlinkSync(tmpTar);
  } catch {
    /* */
  }
  await downloadFollowRedirects(url, tmpTar);
  if (!extractLinuxFfmpeg(tmpTar)) {
    try {
      fs.unlinkSync(tmpTar);
    } catch {
      /* */
    }
    throw new Error("tar extract failed (need tar with xz support)");
  }
  try {
    fs.unlinkSync(tmpTar);
  } catch {
    /* */
  }
}

async function ensureFfmpeg() {
  const log = (m) => process.stderr.write(`[practice-media-deps] ${m}\n`);

  if (tryPath(process.env.FFMPEG_PATH, ffmpegWorks)) {
    return;
  }
  if (ffmpegWorks("ffmpeg")) {
    return;
  }
  if (tryPath(BIN_FFMPEG, ffmpegWorks)) {
    return;
  }

  if (skipFfmpegDownload()) {
    log(
      "ffmpeg not found; Practice seek past buffer needs ffmpeg. Install it, set FFMPEG_PATH, or unset SKIP_FFMPEG_DOWNLOAD.",
    );
    return;
  }

  if (process.platform === "win32") {
    log(
      "ffmpeg not on PATH; install ffmpeg (e.g. winget / chocolatey) or set FFMPEG_PATH.",
    );
    return;
  }

  if (process.platform !== "darwin" && process.platform !== "linux") {
    log(`ffmpeg not found on ${process.platform}; install ffmpeg or set FFMPEG_PATH.`);
    return;
  }

  try {
    if (process.platform === "darwin") {
      log("downloading ffmpeg (macOS static build)…");
      await downloadMacFfmpeg();
    } else {
      if (process.arch !== "arm64" && process.arch !== "x64") {
        log(
          `ffmpeg auto-download not supported for Linux ${process.arch}; install ffmpeg or set FFMPEG_PATH.`,
        );
        return;
      }
      log("downloading ffmpeg (Linux static build)…");
      await downloadLinuxFfmpeg();
    }
  } catch (e) {
    reportOptionalFailure(`ffmpeg download failed: ${e.message || e}`);
    return;
  }

  if (!tryPath(BIN_FFMPEG, ffmpegWorks)) {
    reportOptionalFailure("./bin/ffmpeg did not run.");
  } else {
    log("installed ./bin/ffmpeg (API will use it automatically)");
  }
}

async function main() {
  await ensureYtDlp();
  // Still try ffmpeg even if yt-dlp failed — each is independently useful.
  await ensureFfmpeg();
}

main().catch((e) => {
  reportOptionalFailure(String(e && e.stack ? e.stack : e));
});
