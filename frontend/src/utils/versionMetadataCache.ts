import type { VersionMetadata } from '../types';

const CACHE_KEY = 'asspp-version-metadata-v2';
const LEGACY_CACHE_KEY = 'asspp-version-metadata-v1';
const MAX_ENTRIES = 1000;
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

type CacheEntry = [key: string, displayVersion: string, cachedAt: number];
export interface CachedVersionMetadata extends VersionMetadata {
  cachedAt: number;
}

export function isVersionMetadataFresh(
  metadata: CachedVersionMetadata | undefined,
  now = Date.now(),
): metadata is CachedVersionMetadata {
  return !!metadata && Number.isFinite(metadata.cachedAt) &&
    metadata.cachedAt <= now && now - metadata.cachedAt < CACHE_TTL_MS;
}

function writeEntries(entries: CacheEntry[]): void {
  try {
    if (entries.length === 0) localStorage.removeItem(CACHE_KEY);
    else localStorage.setItem(CACHE_KEY, JSON.stringify(entries));
  } catch {
    // Storage may be disabled or full. The current page still keeps its results.
  }
}

function readEntries(): CacheEntry[] {
  let raw: string | null;
  try {
    // The old cache has no timestamps, so its age cannot be verified.
    localStorage.removeItem(LEGACY_CACHE_KEY);
    raw = localStorage.getItem(CACHE_KEY);
  } catch {
    return [];
  }
  if (raw === null) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = [];
  }
  const now = Date.now();
  const entries = Array.isArray(parsed) ? parsed.filter((entry): entry is CacheEntry =>
    Array.isArray(entry) && entry.length === 3 &&
    typeof entry[0] === 'string' && typeof entry[1] === 'string' &&
    entry[1].trim().length > 0 && typeof entry[2] === 'number' &&
    isVersionMetadataFresh({ displayVersion: entry[1], cachedAt: entry[2] }, now),
  ).slice(-MAX_ENTRIES) : [];

  // Expired and malformed entries are physically removed, not just hidden.
  if (entries.length === 0 || JSON.stringify(entries) !== raw) writeEntries(entries);
  return entries;
}

export function startVersionMetadataCacheCleanup(): () => void {
  const cleanup = () => { readEntries(); };
  const onVisible = () => {
    if (document.visibilityState === 'visible') cleanup();
  };
  cleanup();
  const timer = window.setInterval(cleanup, CLEANUP_INTERVAL_MS);
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
  };
}

export function readVersionMetadataCache(appId: number, store: string): Record<string, CachedVersionMetadata> {
  const prefix = `${store}:${appId}:`;
  return Object.fromEntries(readEntries()
    .filter(([key]) => key.startsWith(prefix))
    .map(([key, displayVersion, cachedAt]) => [key.slice(prefix.length), { displayVersion, cachedAt }]));
}

export function cacheVersionMetadata(
  appId: number,
  store: string,
  versionId: string,
  metadata: VersionMetadata,
): CachedVersionMetadata {
  const key = `${store}:${appId}:${versionId}`;
  const entries = readEntries().filter(([entryKey]) => entryKey !== key);
  // Persist only the public version label and its fetch time, never credentials.
  const cached = { displayVersion: metadata.displayVersion, cachedAt: Date.now() };
  entries.push([key, cached.displayVersion, cached.cachedAt]);
  writeEntries(entries.slice(-MAX_ENTRIES));
  return cached;
}
