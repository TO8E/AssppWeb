import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cacheVersionMetadata, readVersionMetadataCache } from '../../src/utils/versionMetadataCache';

const key = 'asspp-version-metadata-v1';
beforeEach(() => { localStorage.clear(); });

describe('version metadata cache', () => {
  it('isolates labels by application and storefront', () => {
    cacheVersionMetadata(1, 'CN', '100', { displayVersion: '1.0' });
    cacheVersionMetadata(2, 'CN', '100', { displayVersion: '2.0' });
    cacheVersionMetadata(1, 'US', '100', { displayVersion: '3.0' });
    expect(readVersionMetadataCache(1, 'CN')).toEqual({ '100': { displayVersion: '1.0' } });
    expect(readVersionMetadataCache(2, 'CN')).toEqual({ '100': { displayVersion: '2.0' } });
    expect(readVersionMetadataCache(1, 'US')).toEqual({ '100': { displayVersion: '3.0' } });
  });

  it.each(['not json', '{}', 'null', '[null, {}, [1, 2], ["CN:1:1", ""]]'])('tolerates invalid storage: %s', (value) => {
    localStorage.setItem(key, value);
    expect(readVersionMetadataCache(1, 'CN')).toEqual({});
    expect(() => cacheVersionMetadata(1, 'CN', '100', { displayVersion: '1.0' })).not.toThrow();
  });

  it('limits the cache and replaces duplicate entries', () => {
    localStorage.setItem(key, JSON.stringify(Array.from({ length: 1000 }, (_, i) => [`CN:1:${i}`, '1.0'])));
    cacheVersionMetadata(1, 'CN', '1000', { displayVersion: '2.0' });
    cacheVersionMetadata(1, 'CN', '1000', { displayVersion: '3.0' });
    const entries = JSON.parse(localStorage.getItem(key)!);
    expect(entries).toHaveLength(1000);
    expect(entries[0][0]).toBe('CN:1:1');
    expect(readVersionMetadataCache(1, 'CN')['1000']).toEqual({ displayVersion: '3.0' });
  });

  it('remains usable when browser storage is unavailable', () => {
    const get = vi.spyOn(localStorage, 'getItem').mockImplementation(() => { throw new Error('Denied'); });
    const set = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('Quota'); });
    expect(readVersionMetadataCache(1, 'CN')).toEqual({});
    expect(() => cacheVersionMetadata(1, 'CN', '100', { displayVersion: '1.0' })).not.toThrow();
    get.mockRestore();
    set.mockRestore();
  });
});
