const PREFIX = "excelr-admin-cache:";
const DEFAULT_TTL_MS = 45_000;

interface CacheEntry<T> {
  at: number;
  data: T;
}

function readCache<T>(key: string, ttlMs: number): T | null {
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (!entry || Date.now() - entry.at > ttlMs) return null;
    return entry.data;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, data: T): void {
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* quota / private mode */
  }
}

export function clearAdminFetchCache(urlPrefix?: string): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (!key?.startsWith(PREFIX)) continue;
      if (!urlPrefix || key.slice(PREFIX.length).startsWith(urlPrefix)) {
        keys.push(key);
      }
    }
    for (const key of keys) sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Cached GET for admin JSON. Tab switches reuse the last successful payload. */
export async function fetchAdminJson<T extends { ok?: boolean }>(
  url: string,
  opts?: { ttlMs?: number; fresh?: boolean },
): Promise<T> {
  const ttl = opts?.ttlMs ?? DEFAULT_TTL_MS;
  if (!opts?.fresh) {
    const cached = readCache<T>(url, ttl);
    if (cached) return cached;
  }

  const res = await fetch(url, { cache: "no-store" });
  const data = (await res.json()) as T;
  if (res.ok && data && (data as { ok?: boolean }).ok !== false) {
    writeCache(url, data);
  }
  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as { error?: string }).error || "Request failed.")
        : "Request failed.";
    throw new Error(message);
  }
  return data;
}
