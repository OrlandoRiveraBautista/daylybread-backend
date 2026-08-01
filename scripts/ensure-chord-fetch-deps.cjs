#!/usr/bin/env node
/**
 * Ensures Chromium for chord URL import (Puppeteer).
 *
 * Env:
 *   SKIP_CHORD_FETCH_BROWSER_DOWNLOAD=1 — do not download; only log a warning if missing.
 */

const { spawnSync } = require("child_process");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
/** Must live inside the repo so Render includes it in the deploy slug. */
const PUPPETEER_CACHE_DIR = path.join(ROOT, ".cache", "puppeteer");

function log(msg) {
  console.log(`[chord-fetch-deps] ${msg}`);
}

function main() {
  if (process.env.SKIP_CHORD_FETCH_BROWSER_DOWNLOAD === "1") {
    log("SKIP_CHORD_FETCH_BROWSER_DOWNLOAD=1 — skipping Chromium install");
    return;
  }

  process.env.PUPPETEER_CACHE_DIR = PUPPETEER_CACHE_DIR;
  log(`ensuring Puppeteer Chromium (cache: ${PUPPETEER_CACHE_DIR})…`);
  const result = spawnSync(
    "npx",
    ["puppeteer", "browsers", "install", "chrome"],
    { cwd: ROOT, stdio: "inherit", shell: true }
  );

  if (result.status !== 0) {
    console.error(
      "[chord-fetch-deps] Could not install Chromium. Chord import from CifraClub / Ultimate Guitar will fail until you run: npx puppeteer browsers install chrome"
    );
    process.exitCode = 1;
    return;
  }

  log("Puppeteer Chromium ready");
}

main();
