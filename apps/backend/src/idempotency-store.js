const DEFAULT_TTL_MS = 5 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 2000;

export function createIdempotencyStore({ ttlMs = DEFAULT_TTL_MS, maxEntries = DEFAULT_MAX_ENTRIES } = {}) {
  const cache = new Map();

  function cleanup() {
    const now = Date.now();
    for (const [key, entry] of cache.entries()) {
      if (entry.expiresAt <= now) {
        cache.delete(key);
      }
    }

    if (cache.size <= maxEntries) return;

    const sorted = Array.from(cache.entries()).sort((a, b) => a[1].createdAt - b[1].createdAt);
    const overflow = cache.size - maxEntries;
    for (let i = 0; i < overflow; i += 1) {
      cache.delete(sorted[i][0]);
    }
  }

  return {
    get(key, fingerprint) {
      const entry = cache.get(key);
      if (!entry) return { status: 'miss' };
      if (entry.expiresAt <= Date.now()) {
        cache.delete(key);
        return { status: 'miss' };
      }

      if (fingerprint && entry.fingerprint !== fingerprint) {
        return { status: 'conflict' };
      }

      return { status: 'hit', value: entry.value };
    },
    set(key, fingerprint, value) {
      cleanup();
      cache.set(key, {
        fingerprint,
        value,
        createdAt: Date.now(),
        expiresAt: Date.now() + ttlMs,
      });
    },
  };
}
