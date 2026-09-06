import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cacheVersionMetadata,
  isVersionMetadataFresh,
  readVersionMetadataCache,
  startVersionMetadataCacheCleanup,
} from '../../src/utils/versionMetadataCache';

const key = 'asspp-version-metadata-v2';
const legacyKey = 'asspp-version-metadata-v1';
const day = 24 * 60 * 60 * 1000;
let stopCleanup: (() => void) | undefined;

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-06T00:00:00Z'));
});
afterEach(() => {
  stopCleanup?.();
  stopCleanup = undefined;
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('version metadata cache', () => {
  it('isolates labels by application and storefront', () => {
    cacheVersionMetadata(1, 'CN', '100', { displayVersion: '1.0' });
    cacheVersionMetadata(2, 'CN', '100', { displayVersion: '2.0' });
    cacheVersionMetadata(1, 'US', '100', { displayVersion: '3.0' });
    expect(readVersionMetadataCache(1, 'CN')).toEqual({ '100': { displayVersion: '1.0', cachedAt: Date.now() } });
    expect(readVersionMetadataCache(2, 'CN')).toEqual({ '100': { displayVersion: '2.0', cachedAt: Date.now() } });
    expect(readVersionMetadataCache(1, 'US')).toEqual({ '100': { displayVersion: '3.0', cachedAt: Date.now() } });
  });

  it.each(['not json', '{}', 'null', '[null, {}, [1, 2], ["CN:1:1", ""]]'])('removes invalid storage: %s', (value) => {
    localStorage.setItem(key, value);
    expect(readVersionMetadataCache(1, 'CN')).toEqual({});
    expect(localStorage.getItem(key)).toBeNull();
    expect(() => cacheVersionMetadata(1, 'CN', '100', { displayVersion: '1.0' })).not.toThrow();
  });

  it('limits the cache and replaces duplicate entries', () => {
    localStorage.setItem(key, JSON.stringify(Array.from({ length: 1000 }, (_, i) => [`CN:1:${i}`, '1.0', Date.now()])));
    cacheVersionMetadata(1, 'CN', '1000', { displayVersion: '2.0' });
    cacheVersionMetadata(1, 'CN', '1000', { displayVersion: '3.0' });
    const entries = JSON.parse(localStorage.getItem(key)!);
    expect(entries).toHaveLength(1000);
    expect(entries[0][0]).toBe('CN:1:1');
    expect(readVersionMetadataCache(1, 'CN')['1000']).toEqual({ displayVersion: '3.0', cachedAt: Date.now() });
  });

  it('remains usable when browser storage is unavailable', () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => { throw new Error('Denied'); });
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('Quota'); });
    expect(readVersionMetadataCache(1, 'CN')).toEqual({});
    const cached = cacheVersionMetadata(1, 'CN', '100', { displayVersion: '1.0' });
    expect(isVersionMetadataFresh(cached)).toBe(true);
    vi.setSystemTime(Date.now() + 30 * day);
    expect(isVersionMetadataFresh(cached)).toBe(false);
  });

  it('expires exactly 30 days after fetching and does not extend lifetime on reads', () => {
    cacheVersionMetadata(1, 'CN', '100', { displayVersion: '1.0' });
    const original = localStorage.getItem(key);
    vi.setSystemTime(Date.now() + 30 * day - 1);
    expect(readVersionMetadataCache(1, 'CN')['100'].displayVersion).toBe('1.0');
    expect(localStorage.getItem(key)).toBe(original);
    vi.setSystemTime(Date.now() + 1);
    expect(readVersionMetadataCache(1, 'CN')).toEqual({});
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('cleans all apps while retaining entries younger than 30 days', () => {
    const start = Date.now();
    cacheVersionMetadata(1, 'CN', '100', { displayVersion: '1.0' });
    vi.setSystemTime(start + day);
    cacheVersionMetadata(2, 'US', '200', { displayVersion: '2.0' });
    vi.setSystemTime(start + 30 * day);
    expect(readVersionMetadataCache(2, 'US')['200'].displayVersion).toBe('2.0');
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual([['US:2:200', '2.0', start + day]]);
  });

  it('cleans expired entries on writes as well as reads', () => {
    cacheVersionMetadata(1, 'CN', '100', { displayVersion: '1.0' });
    vi.setSystemTime(Date.now() + 31 * day);
    cacheVersionMetadata(1, 'CN', '101', { displayVersion: '1.1' });
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual([['CN:1:101', '1.1', Date.now()]]);
  });

  it('drops legacy entries without timestamps and preserves unrelated storage', () => {
    localStorage.setItem(legacyKey, JSON.stringify([['CN:1:100', '1.0']]));
    localStorage.setItem('asspp-settings', 'settings-fixture');
    localStorage.setItem('unrelated-account-fixture', 'account-fixture');
    stopCleanup = startVersionMetadataCacheCleanup();
    expect(localStorage.getItem(legacyKey)).toBeNull();
    expect(localStorage.getItem('asspp-settings')).toBe('settings-fixture');
    expect(localStorage.getItem('unrelated-account-fixture')).toBe('account-fixture');
  });

  it('removes expired storage immediately when the app starts again', () => {
    cacheVersionMetadata(1, 'CN', '100', { displayVersion: '1.0' });
    vi.setSystemTime(Date.now() + 31 * day);
    stopCleanup = startVersionMetadataCacheCleanup();
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('cleans hourly while the page is open and releases its timer on unmount', () => {
    cacheVersionMetadata(1, 'CN', '100', { displayVersion: '1.0' });
    vi.setSystemTime(Date.now() + 30 * day - 60 * 60 * 1000);
    stopCleanup = startVersionMetadataCacheCleanup();
    expect(localStorage.getItem(key)).not.toBeNull();
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(localStorage.getItem(key)).toBeNull();
    stopCleanup();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cleans when a suspended tab becomes visible again', () => {
    stopCleanup = startVersionMetadataCacheCleanup();
    cacheVersionMetadata(1, 'CN', '100', { displayVersion: '1.0' });
    vi.setSystemTime(Date.now() + 31 * day);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('rejects future or nonnumeric timestamps', () => {
    localStorage.setItem(key, JSON.stringify([
      ['CN:1:100', '1.0', Date.now() + day], ['CN:1:101', '1.1', 'yesterday'],
    ]));
    expect(readVersionMetadataCache(1, 'CN')).toEqual({});
    expect(localStorage.getItem(key)).toBeNull();
  });
});
