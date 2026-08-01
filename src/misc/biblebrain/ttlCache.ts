type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

/**
 * In-process TTL cache with singleflight coalescing for in-flight misses.
 * Suitable for a single Render instance; avoids stampedes on popular keys.
 */
export class TtlCache {
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private readonly inflight = new Map<string, Promise<unknown>>();

  constructor(private readonly maxEntries = 2000) {}

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    if (this.store.size >= this.maxEntries) {
      this.evictExpired();
    }
    if (this.store.size >= this.maxEntries) {
      // Drop oldest insertion if still full
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  async getOrSet<T>(
    key: string,
    ttlMs: number,
    factory: () => Promise<T>
  ): Promise<T> {
    const hit = this.get<T>(key);
    if (hit !== undefined) return hit;

    const existing = this.inflight.get(key) as Promise<T> | undefined;
    if (existing) return existing;

    const promise = factory()
      .then((value) => {
        this.set(key, value, ttlMs);
        return value;
      })
      .finally(() => {
        this.inflight.delete(key);
      });

    this.inflight.set(key, promise);
    return promise;
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) this.store.delete(key);
    }
  }
}

export const bibleBrainCache = new TtlCache();
