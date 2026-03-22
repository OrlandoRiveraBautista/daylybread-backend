import { FastifyInstance } from "fastify";
import { spawn, ChildProcess } from "child_process";
import { Readable } from "stream";
import {
  detectStreamedAudioMime,
  extractYoutubeVideoId,
  formatYtDlpSectionFromStartSeconds,
  isFfmpegAvailable,
  parseYoutubeAudioStartQuery,
  resolveFfmpegExecutable,
  resolveYtDlpExecutable,
  getYtDlpCookieCliArgs,
  isYtDlpCookiesConfigured,
  warnIfYtDlpCookieFileEnvMissing,
} from "../utils/youtubeAudio";

/** CORS origins aligned with Apollo in app.ts */
const CORS_ORIGINS = new Set<string>([
  "http://localhost:8100",
  "http://localhost:3000",
  "http://127.0.0.1:8100",
  "http://127.0.0.1:3000",
  "https://daylybread-marketr.web.app",
  "https://daylybread-dev.web.app",
  "http://bible.daylybread.local:8100",
  "http://app.daylybread.local:8100",
  "http://nfc.daylybread.local:8100",
  "http://platform.daylybread.local:8100",
  "https://platform.dev.daylybread.com",
  "https://app.dev.daylybread.com",
  "https://bible.dev.daylybread.com",
  "https://nfc.dev.daylybread.com",
  "https://app.daylybread.com",
  "https://bible.daylybread.com",
  "https://nfc.daylybread.com",
  "https://platform.daylybread.com",
]);

const PROBE_TIMEOUT_MS = 15_000;
const STREAM_FIRST_BYTE_MS = 25_000;

function mergeFirstChunkStream(first: Buffer, rest: Readable): Readable {
  return Readable.from(
    (async function* () {
      yield first;
      for await (const chunk of rest) {
        yield chunk as Buffer;
      }
    })(),
  );
}

/**
 * Wait for yt-dlp to emit the first payload byte so we can set a matching Content-Type.
 */
function readFirstStdoutChunk(
  proc: ChildProcess,
  stderrAccumulator: { text: string },
  timeoutMs: number,
): Promise<Buffer> {
  const stdout = proc.stdout;
  if (!stdout) {
    return Promise.reject(new Error("yt-dlp has no stdout"));
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      stdout.off("data", onData);
      stdout.off("error", onErr);
      proc.off("close", onClose);
    };

    const timer = setTimeout(() => {
      cleanup();
      try {
        proc.kill("SIGKILL");
      } catch {
        /* */
      }
      reject(
        new Error(
          "Timed out waiting for audio data. Try: yt-dlp -U server-side, or install ffmpeg.",
        ),
      );
    }, timeoutMs);

    const onData = (c: Buffer) => {
      cleanup();
      resolve(c);
    };
    const onErr = (err: Error) => {
      cleanup();
      reject(err);
    };

    const onClose = (code: number | null) => {
      if (code !== 0 && code !== null) {
        cleanup();
        reject(
          new Error(
            stderrAccumulator.text.trim().slice(-800) ||
              `yt-dlp exited with code ${code}`,
          ),
        );
      }
    };

    stdout.once("data", onData);
    stdout.once("error", onErr);
    proc.once("close", onClose);
  });
}

function setCorsHeaders(
  origin: string | undefined,
  reply: {
    header: (k: string, v: string) => void;
  },
) {
  if (origin && CORS_ORIGINS.has(origin)) {
    reply.header("Access-Control-Allow-Origin", origin);
    reply.header("Access-Control-Allow-Credentials", "true");
  } else {
    reply.header("Access-Control-Allow-Origin", "*");
  }
}

type ProbeResult = {
  ok: boolean;
  message?: string;
  hint?: string;
};

function runYoutubeProbe(
  ytdlp: string,
  watchUrl: string,
): Promise<ProbeResult> {
  return new Promise((resolve) => {
    let finished = false;
    const done = (r: ProbeResult) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve(r);
    };

    let proc: ChildProcess;
    const cookieArgs = getYtDlpCookieCliArgs();
    try {
      proc = spawn(
        ytdlp,
        [...cookieArgs, "--no-warnings", "--get-id", "--no-playlist", watchUrl],
        { stdio: ["ignore", "pipe", "pipe"] },
      );
    } catch (err) {
      done({
        ok: false,
        message: err instanceof Error ? err.message : "Failed to start yt-dlp",
        hint: "macOS: brew install yt-dlp · Linux: install yt-dlp via pip or your package manager.",
      });
      return;
    }

    let stderr = "";
    let stdout = "";
    proc.stdout?.on("data", (c: Buffer) => {
      stdout += c.toString();
    });
    proc.stderr?.on("data", (c: Buffer) => {
      stderr += c.toString();
    });

    const timer = setTimeout(() => {
      try {
        proc.kill("SIGKILL");
      } catch {
        /* */
      }
      done({
        ok: false,
        message:
          "yt-dlp timed out (network, rate limit, or YouTube blocking the server IP).",
        hint: "Try again. From the API host, run: yt-dlp --get-id 'YOUTUBE_URL'",
      });
    }, PROBE_TIMEOUT_MS);

    proc.on("error", (err: NodeJS.ErrnoException) => {
      done({
        ok: false,
        message:
          err.code === "ENOENT"
            ? "yt-dlp is not installed or YT_DLP_PATH is wrong."
            : err.message,
        hint: "Install yt-dlp on the machine running the Daylybread API, then restart the server. macOS: brew install yt-dlp",
      });
    });

    proc.on("close", (code) => {
      if (finished) return;
      clearTimeout(timer);
      if (code === 0) {
        done({ ok: true });
        return;
      }
      const errText = (stderr || stdout).trim().slice(-1200);
      const botChallenge = /sign in|not a bot/i.test(errText);
      const cookiesOn = isYtDlpCookiesConfigured();
      let hint =
        "Update: yt-dlp -U  ·  Install ffmpeg if needed: brew install ffmpeg";
      if (botChallenge && !cookiesOn) {
        hint =
          "YouTube is challenging this server IP. Set YT_DLP_COOKIES or YT_DLP_COOKIES_FILE (exact /etc/secrets/<filename> on Render). See yt-dlp wiki: exporting YouTube cookies.";
      } else if (botChallenge && cookiesOn) {
        hint =
          "Cookies are passed but YouTube still blocked the request. Re-export fresh Netscape cookies (logged-in session), ensure the file is not empty, update yt-dlp on deploy, and see yt-dlp PO Token guide if issues persist.";
      }
      done({
        ok: false,
        message: errText || `yt-dlp exited with code ${code}`,
        hint,
      });
    });
  });
}

/**
 * Stream YouTube audio via yt-dlp (must be on PATH or YT_DLP_PATH).
 * Probe: GET /api/youtube-audio-probe/:videoId — JSON { ok, message?, hint? }
 */
export function registerYoutubeAudioProxyRoutes(app: FastifyInstance) {
  warnIfYtDlpCookieFileEnvMissing(app.log);

  app.options("/api/youtube-audio/:videoId", (request, reply) => {
    setCorsHeaders(request.headers.origin, reply);
    reply.header("Access-Control-Allow-Methods", "GET, OPTIONS");
    reply.header("Access-Control-Allow-Headers", "Range, Content-Type");
    reply.code(204).send();
  });

  app.options("/api/youtube-audio-probe/:videoId", (request, reply) => {
    setCorsHeaders(request.headers.origin, reply);
    reply.header("Access-Control-Allow-Methods", "GET, OPTIONS");
    reply.header("Access-Control-Allow-Headers", "Content-Type");
    reply.code(204).send();
  });

  app.get<{ Params: { videoId: string } }>(
    "/api/youtube-audio-probe/:videoId",
    async (request, reply) => {
      const videoId = extractYoutubeVideoId(request.params.videoId);
      if (!videoId) {
        setCorsHeaders(request.headers.origin, reply);
        reply.code(400).send({
          ok: false,
          message: "Invalid YouTube video id",
        });
        return;
      }

      setCorsHeaders(request.headers.origin, reply);
      const ytdlp = resolveYtDlpExecutable();
      const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const result = await runYoutubeProbe(ytdlp, watchUrl);
      const cookiesConfiguredForYtDlp = isYtDlpCookiesConfigured();
      if (!result.ok) {
        reply.code(503).send({ ...result, cookiesConfiguredForYtDlp });
        return;
      }
      reply.send({
        ok: true,
        seekFromTimestampSupported: isFfmpegAvailable(),
        cookiesConfiguredForYtDlp,
      });
    },
  );

  app.get<{
    Params: { videoId: string };
    Querystring: { start?: string };
  }>("/api/youtube-audio/:videoId", async (request, reply) => {
    const videoId = extractYoutubeVideoId(request.params.videoId);
    if (!videoId) {
      setCorsHeaders(request.headers.origin, reply);
      reply.status(400).send({ error: "invalid_video_id" });
      return;
    }

    const startSec = parseYoutubeAudioStartQuery(request.query?.start);
    const ytdlp = resolveYtDlpExecutable();
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;

    if (startSec > 0.05 && !isFfmpegAvailable()) {
      setCorsHeaders(request.headers.origin, reply);
      void reply.status(503).send({
        error: "ffmpeg_required_for_seek",
        message:
          "Streaming from a timestamp (?start=) requires ffmpeg on the API server (yt-dlp --download-sections).",
        hint: "Run `npm run dev` once so scripts/ensure-practice-media-deps.cjs downloads ./bin/ffmpeg, or install ffmpeg and set FFMPEG_PATH. The API re-checks for ffmpeg every few seconds—no full restart needed after it appears.",
        resolvedFfmpegPath: resolveFfmpegExecutable(),
      });
      return;
    }

    /**
     * Prefer m4a (itag 140); fall back to other audio. We sniff the first bytes
     * so Content-Type matches (WebM + audio/mp4 breaks many browsers).
     * `?start=N` (seconds): stream from N — uses `--download-sections` (**ffmpeg required**).
     * Without ffmpeg, omit ?start and seek will reload from 0 only.
     */
    const ytdlpArgs = [
      ...getYtDlpCookieCliArgs(),
      "-f",
      "140/ba[ext=m4a]/ba/bestaudio/best",
      "-o",
      "-",
      "--no-playlist",
      "--no-warnings",
    ];
    if (startSec > 0.05) {
      ytdlpArgs.push(
        "--download-sections",
        formatYtDlpSectionFromStartSeconds(startSec),
      );
    }
    ytdlpArgs.push(watchUrl);

    const proc = spawn(ytdlp, ytdlpArgs, { stdio: ["ignore", "pipe", "pipe"] });

    const stderrAccumulator = { text: "" };
    proc.stderr?.on("data", (chunk: Buffer) => {
      stderrAccumulator.text += chunk.toString();
    });

    proc.on("error", (err: NodeJS.ErrnoException) => {
      request.log.error(err, "yt-dlp spawn failed");
      if (!reply.raw.headersSent) {
        setCorsHeaders(request.headers.origin, reply);
        void reply.status(503).send({
          error: "yt_dlp_unavailable",
          message:
            err.code === "ENOENT"
              ? "yt-dlp is not installed or YT_DLP_PATH is wrong."
              : err.message,
        });
      }
    });

    proc.on("close", (code) => {
      if (code !== 0 && code !== null) {
        request.log.warn(
          { stderr: stderrAccumulator.text.slice(-2000), code },
          "yt-dlp exited with error",
        );
      }
    });

    let first: Buffer;
    try {
      first = await readFirstStdoutChunk(
        proc,
        stderrAccumulator,
        STREAM_FIRST_BYTE_MS,
      );
    } catch (err) {
      request.log.warn(
        {
          err,
          stderr: stderrAccumulator.text.slice(-1500),
        },
        "youtube-audio stream failed before first byte",
      );
      if (!reply.raw.headersSent) {
        setCorsHeaders(request.headers.origin, reply);
        const stderrTail = stderrAccumulator.text.trim().slice(-1500);
        const cookiesOn = isYtDlpCookiesConfigured();
        const botChallenge = /sign in|not a bot/i.test(
          stderrTail + (err instanceof Error ? err.message : ""),
        );
        let streamHint: string | undefined;
        if (botChallenge && !cookiesOn) {
          streamHint =
            "No cookies were loaded. Set YT_DLP_COOKIES_FILE to the exact Render secret path (e.g. /etc/secrets/www.youtube.com_cookies) or paste Netscape cookies into YT_DLP_COOKIES.";
        } else if (botChallenge && cookiesOn) {
          streamHint =
            "Cookies are set but YouTube still blocked the request. Re-export fresh Netscape cookies, confirm the secret file is not empty, and redeploy with the latest yt-dlp.";
        }
        void reply.status(503).send({
          error: "youtube_audio_stream_failed",
          message:
            err instanceof Error ? err.message : "Could not start audio stream",
          cookiesConfiguredForYtDlp: cookiesOn,
          ...(streamHint ? { hint: streamHint } : {}),
          ...(stderrTail ? { ytDlpStderr: stderrTail } : {}),
        });
      }
      return;
    }

    const mime = detectStreamedAudioMime(first);
    setCorsHeaders(request.headers.origin, reply);
    reply.header("Content-Type", mime);
    reply.header("Accept-Ranges", "none");
    reply.header("Cache-Control", "private, max-age=3600");

    const stdout = proc.stdout;
    if (!stdout) {
      void reply.status(500).send({ error: "no_stdout" });
      return;
    }

    reply.send(mergeFirstChunkStream(first, stdout));
  });
}
