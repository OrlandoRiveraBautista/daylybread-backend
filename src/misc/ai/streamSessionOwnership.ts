/**
 * In-memory ownership for AI stream subscription topics.
 * Binds opaque session/device channel ids to the authenticated principal
 * (or anonymous device claim) so subscriptions cannot IDOR other users' streams.
 */

type OwnershipRecord = {
  ownerKey: string;
  expiresAt: number;
};

const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes
const store = new Map<string, OwnershipRecord>();

function sweep(now = Date.now()): void {
  for (const [key, value] of store) {
    if (value.expiresAt <= now) store.delete(key);
  }
}

export function claimStreamChannel(
  channelKey: string,
  ownerKey: string,
  ttlMs: number = DEFAULT_TTL_MS
): void {
  sweep();
  store.set(channelKey, {
    ownerKey: String(ownerKey),
    expiresAt: Date.now() + ttlMs,
  });
}

/**
 * Claim channel if unclaimed or already owned by ownerKey.
 * Returns false if another principal already owns it.
 */
export function claimStreamChannelIfAvailable(
  channelKey: string,
  ownerKey: string,
  ttlMs: number = DEFAULT_TTL_MS
): boolean {
  sweep();
  const existing = store.get(channelKey);
  if (
    existing &&
    existing.expiresAt > Date.now() &&
    existing.ownerKey !== String(ownerKey)
  ) {
    return false;
  }
  claimStreamChannel(channelKey, ownerKey, ttlMs);
  return true;
}

export function isStreamChannelOwner(
  channelKey: string,
  ownerKey: string | undefined
): boolean {
  if (!ownerKey) return false;
  sweep();
  const record = store.get(channelKey);
  if (!record) return false;
  if (record.expiresAt <= Date.now()) {
    store.delete(channelKey);
    return false;
  }
  return record.ownerKey === String(ownerKey);
}

export function releaseStreamChannel(channelKey: string): void {
  store.delete(channelKey);
}

export function sermonChannelKey(sessionId: string): string {
  return `sermon:${sessionId}`;
}

export function chatChannelKey(deviceId: string): string {
  return `chat:${deviceId}`;
}

/** UUID v4-ish device ids used by the web client. */
export function isValidDeviceChannelId(deviceId: string | undefined): boolean {
  if (!deviceId) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    deviceId.trim()
  );
}
