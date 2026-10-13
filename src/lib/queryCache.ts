// Small read-through cache for public Supabase reads.
//
// Every component that mounts a data hook used to fire its own request (the
// header, footer and COA page each fetched the same setting; every tab switch
// refetched the whole catalog). This module de-duplicates in-flight requests,
// keeps results in memory, and persists them to localStorage for a short TTL so
// a returning visitor does not download the catalog again on every page load.
//
// Admin pages always bypass the cache so edits are visible immediately.

const STORAGE_PREFIX = 'sd-cache:v1:';
export const DEFAULT_TTL_MS = 5 * 60 * 1000;

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

interface CacheOptions {
  ttlMs?: number;
  force?: boolean;
}

const memory = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

export const isAdminRoute = (): boolean =>
  typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');

function readStored<T>(key: string): CacheEntry<T> | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
    return raw ? (JSON.parse(raw) as CacheEntry<T>) : null;
  } catch {
    return null;
  }
}

function writeStored<T>(key: string, entry: CacheEntry<T>): void {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // Storage full or blocked (private mode) — memory cache still works.
  }
}

function getFresh<T>(key: string, ttlMs: number): CacheEntry<T> | null {
  const entry = (memory.get(key) as CacheEntry<T> | undefined) ?? readStored<T>(key);
  if (!entry || Date.now() - entry.fetchedAt > ttlMs) return null;
  memory.set(key, entry);
  return entry;
}

/**
 * Returns cached data when it is younger than `ttlMs`, otherwise runs `fetcher`.
 * Concurrent callers for the same key share one request. Errors are never cached.
 */
export async function cachedQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  { ttlMs = DEFAULT_TTL_MS, force = isAdminRoute() }: CacheOptions = {},
): Promise<T> {
  if (!force) {
    const fresh = getFresh<T>(key, ttlMs);
    if (fresh) return fresh.data;
  }

  const pending = inFlight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const request = fetcher()
    .then((data) => {
      const entry = { data, fetchedAt: Date.now() };
      memory.set(key, entry);
      writeStored(key, entry);
      return data;
    })
    .finally(() => inFlight.delete(key));

  inFlight.set(key, request);
  return request;
}

/** Drops cached entries whose key starts with `prefix` (call after admin writes). */
export function invalidateCache(prefix: string): void {
  for (const key of Array.from(memory.keys())) {
    if (key.startsWith(prefix)) memory.delete(key);
  }
  try {
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX + prefix)) window.localStorage.removeItem(key);
    }
  } catch {
    // Storage unavailable — nothing persisted to clear.
  }
}
