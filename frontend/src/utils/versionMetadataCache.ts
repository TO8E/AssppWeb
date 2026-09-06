import type { VersionMetadata } from '../types';

const CACHE_KEY = 'asspp-version-metadata-v1';
const MAX_ENTRIES = 1000;

function readEntries(): [string, string][] {
  try {
    const entries: unknown = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '[]');
    if (!Array.isArray(entries)) return [];
    return entries.filter((entry): entry is [string, string] =>
      Array.isArray(entry) && entry.length === 2 &&
      typeof entry[0] === 'string' && typeof entry[1] === 'string' &&
      entry[1].trim().length > 0,
    ).slice(-MAX_ENTRIES);
  } catch {
    return [];
  }
}

export function readVersionMetadataCache(appId: number, store: string): Record<string, VersionMetadata> {
  const prefix = `${store}:${appId}:`;
  return Object.fromEntries(readEntries()
    .filter(([key]) => key.startsWith(prefix))
    .map(([key, displayVersion]) => [key.slice(prefix.length), { displayVersion }]));
}

export function cacheVersionMetadata(
  appId: number,
  store: string,
  versionId: string,
  metadata: VersionMetadata,
): void {
  const key = `${store}:${appId}:${versionId}`;
  const entries = readEntries().filter(([entryKey]) => entryKey !== key);
  // Persist only the public version label, never account records or cookies.
  entries.push([key, metadata.displayVersion]);
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    // Storage may be disabled or full. The current page still keeps its results.
  }
}
