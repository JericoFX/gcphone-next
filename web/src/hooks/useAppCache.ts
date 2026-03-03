import { createSignal } from 'solid-js';

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const memoryCache = new Map<string, CacheEntry<unknown>>();

export function useAppCache(prefix: string) {
  const [version, setVersion] = createSignal(0);

  const buildKey = (key: string) => `${prefix}:${key}`;

  const get = <T>(key: string): T | null => {
    const entry = memoryCache.get(buildKey(key)) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      memoryCache.delete(buildKey(key));
      return null;
    }
    return entry.value;
  };

  const set = <T>(key: string, value: T, ttlMs = 30000) => {
    memoryCache.set(buildKey(key), {
      value,
      expiresAt: Date.now() + Math.max(1000, ttlMs),
    });
    setVersion((v) => v + 1);
  };

  const invalidate = (key?: string) => {
    if (key) {
      memoryCache.delete(buildKey(key));
    } else {
      const startsWith = `${prefix}:`;
      for (const cacheKey of memoryCache.keys()) {
        if (cacheKey.startsWith(startsWith)) {
          memoryCache.delete(cacheKey);
        }
      }
    }
    setVersion((v) => v + 1);
  };

  return {
    get,
    set,
    invalidate,
    version,
  };
}
