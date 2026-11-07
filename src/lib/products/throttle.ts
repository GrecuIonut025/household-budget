/** Small in-process helpers for the Open Food Facts proxy (best effort per server instance). */

export interface Clock {
  now(): number;
}

export function createTtlCache<V>(ttlMs: number, maxEntries = 500, clock: Clock = Date) {
  const entries = new Map<string, { value: V; expires: number }>();
  return {
    get(key: string): V | undefined {
      const hit = entries.get(key);
      if (!hit) return undefined;
      if (hit.expires <= clock.now()) {
        entries.delete(key);
        return undefined;
      }
      return hit.value;
    },
    set(key: string, value: V, ttlOverrideMs = ttlMs): void {
      if (entries.size >= maxEntries) {
        const oldest = entries.keys().next().value;
        if (oldest !== undefined) entries.delete(oldest);
      }
      entries.delete(key);
      entries.set(key, { value, expires: clock.now() + ttlOverrideMs });
    },
  };
}

/** Sliding-window limiter: at most `limit` hits per `windowMs` for each key. */
export function createRateLimiter(limit: number, windowMs: number, clock: Clock = Date) {
  const hits = new Map<string, number[]>();
  return {
    /** Records a hit and returns false when the key is over its limit. */
    take(key: string): boolean {
      const now = clock.now();
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.set(key, recent);
      return true;
    },
  };
}
