import dns from "dns";
import net from "net";
import { promisify } from "util";

const lookup = promisify(dns.lookup);

/** Hosts we are willing to fetch chord sheets from (exact registrable domain or subdomain). */
export const ALLOWED_CHORD_HOSTS = [
  "lacuerda.net",
  "cifraclub.com",
  "ultimate-guitar.com",
] as const;

export type SafeChordUrlResult =
  | { ok: true; url: string; hostname: string }
  | { ok: false; message: string };

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
}

export function isAllowedChordHost(hostname: string): boolean {
  const bare = normalizeHostname(hostname);
  return ALLOWED_CHORD_HOSTS.some(
    (allowed) => bare === allowed || bare.endsWith(`.${allowed}`)
  );
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return null;
  }
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

function isPrivateOrReservedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const n = ipv4ToInt(ip);
    if (n === null) return true;
    // 0.0.0.0/8, 10.0.0.0/8, 127.0.0.0/8, 169.254.0.0/16,
    // 172.16.0.0/12, 192.168.0.0/16, 100.64.0.0/10, 192.0.0.0/24, 192.0.2.0/24,
    // 198.51.100.0/24, 203.0.113.0/24, 224.0.0.0/4, 240.0.0.0/4
    if ((n & 0xff000000) === 0x00000000) return true;
    if ((n & 0xff000000) === 0x0a000000) return true;
    if ((n & 0xff000000) === 0x7f000000) return true;
    if ((n & 0xffff0000) === 0xa9fe0000) return true;
    if ((n & 0xfff00000) === 0xac100000) return true;
    if ((n & 0xffff0000) === 0xc0a80000) return true;
    if ((n & 0xffc00000) === 0x64400000) return true;
    if ((n & 0xffffff00) === 0xc0000000) return true;
    if ((n & 0xffffff00) === 0xc0000200) return true;
    if ((n & 0xffffff00) === 0xc6336400) return true;
    if ((n & 0xffffff00) === 0xcb007100) return true;
    if ((n & 0xf0000000) === 0xe0000000) return true;
    if ((n & 0xf0000000) === 0xf0000000) return true;
    return false;
  }

  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    if (normalized === "::" || normalized === "::1") return true;
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // unique local
    if (
      normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") ||
      normalized.startsWith("fea") ||
      normalized.startsWith("feb")
    ) {
      return true; // link-local
    }
    // IPv4-mapped IPv6
    if (normalized.startsWith("::ffff:")) {
      const mapped = normalized.slice("::ffff:".length);
      if (net.isIPv4(mapped)) return isPrivateOrReservedIp(mapped);
    }
    return false;
  }

  return true;
}

/**
 * Parse + allowlist a chord import URL. Does not perform DNS yet.
 */
export function parseAllowedChordUrl(raw: string): SafeChordUrlResult {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return { ok: false, message: "Invalid URL. Please enter a valid link." };
  }

  if (parsed.protocol !== "https:") {
    return {
      ok: false,
      message: "Only HTTPS URLs are supported for chord import.",
    };
  }

  if (parsed.username || parsed.password) {
    return { ok: false, message: "URLs with credentials are not allowed." };
  }

  if (!isAllowedChordHost(parsed.hostname)) {
    return {
      ok: false,
      message:
        "This site is not supported. Use Ultimate Guitar, Cifra Club, or La Cuerda — or paste the chords manually.",
    };
  }

  // Reject literal IP hosts even if somehow allowlisted later.
  if (net.isIP(parsed.hostname)) {
    return { ok: false, message: "IP address URLs are not allowed." };
  }

  const hostname = normalizeHostname(parsed.hostname);
  return { ok: true, url: parsed.toString(), hostname };
}

/**
 * Resolve hostname and reject private/link-local/metadata targets (SSRF).
 */
export async function assertPublicHostname(hostname: string): Promise<void> {
  const bare = normalizeHostname(hostname);
  let result: { address: string; family: number };
  try {
    result = await lookup(bare, { all: false });
  } catch {
    throw new Error("Could not resolve host for this URL.");
  }

  if (isPrivateOrReservedIp(result.address)) {
    throw new Error("URL target is not allowed.");
  }
}
