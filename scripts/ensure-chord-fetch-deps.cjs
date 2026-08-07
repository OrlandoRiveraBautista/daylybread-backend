#!/usr/bin/env node
/**
 * Ensures Chromium for chord URL import (Puppeteer).
 *
 * Used for CifraClub / Ultimate Guitar (and as a fallback for other hosts).
 * axios + cheerio still work without Chromium for sites like La Cuerda.
 *
 * Failures are soft by default: browser-dependent chord import may be
 * unavailable, but `npm run dev` / `compile` still continue.
 *
 * Env:
 *   SKIP_CHORD_FETCH_BROWSER_DOWNLOAD=1 — do not download; only log a warning if skipping.
 *   REQUIRE_CHORD_FETCH_DEPS=1          — exit non-zero on failure (CI / deploys that need browser import).
 */

const { spawnSync } = require("child_process");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
/** Must live inside the repo so Render includes it in the deploy slug. */
const PUPPETEER_CACHE_DIR = path.join(ROOT, ".cache", "puppeteer");

function log(msg) {
  console.log(`[chord-fetch-deps] ${msg}`);
}

function requireChordFetchDeps() {
  return process.env.REQUIRE_CHORD_FETCH_DEPS === "1";
}

/** Soft-fail unless REQUIRE_CHORD_FETCH_DEPS=1. */
function reportOptionalFailure(message) {
  console.error(`[chord-fetch-deps] ${message}`);
  console.error(
    "[chord-fetch-deps] continuing without Chromium (CifraClub / Ultimate Guitar import may fail; axios+cheerio hosts still work). Set REQUIRE_CHORD_FETCH_DEPS=1 to make this fatal.",
  );
  if (requireChordFetchDeps()) {
    process.exitCode = 1;
  }
}

function main() {
  if (process.env.SKIP_CHORD_FETCH_BROWSER_DOWNLOAD === "1") {
    log(
      "SKIP_CHORD_FETCH_BROWSER_DOWNLOAD=1 — skipping Chromium install (browser-dependent chord import may fail)",
    );
    return;
  }

  process.env.PUPPETEER_CACHE_DIR = PUPPETEER_CACHE_DIR;
  log(`ensuring Puppeteer Chromium (cache: ${PUPPETEER_CACHE_DIR})…`);
  const result = spawnSync(
    "npx",
    ["puppeteer", "browsers", "install", "chrome"],
    { cwd: ROOT, stdio: "inherit", shell: true },
  );

  if (result.error) {
    reportOptionalFailure(
      `Could not install Chromium: ${result.error.message || result.error}. Run: npx puppeteer browsers install chrome`,
    );
    return;
  }

  if (result.status !== 0) {
    reportOptionalFailure(
      "Could not install Chromium. Chord import from CifraClub / Ultimate Guitar will fail until you run: npx puppeteer browsers install chrome",
    );
    return;
  }

  log("Puppeteer Chromium ready");
}

main();
