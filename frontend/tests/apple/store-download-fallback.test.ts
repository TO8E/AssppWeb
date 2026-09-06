import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDownloadInfo } from '../../src/apple/download';
import { buildPlist, parsePlist } from '../../src/apple/plist';
import { appleRequest } from '../../src/apple/request';
import { listVersions } from '../../src/apple/versionFinder';
import { getVersionMetadata } from '../../src/apple/versionLookup';
import type { Account, Software } from '../../src/types';

vi.mock('../../src/apple/request', () => ({ appleRequest: vi.fn() }));

const account = {
  email: 'fixture@example.com', password: '', appleId: 'fixture',
  store: '143465', firstName: '', lastName: '', passwordToken: 'fixture',
  directoryServicesIdentifier: '123', cookies: [],
  deviceIdentifier: 'aabbccddeeff', pod: '11',
} satisfies Account;
const app = { id: '461703208', bundleID: 'com.example.fixture' } as Software;

function response(body: Record<string, unknown>, status = 200) {
  return { status, statusText: 'OK', headers: {}, rawHeaders: [], body: buildPlist(body) };
}

const success = {
  status: 0,
  songList: [{
    URL: 'https://example.apple.com/fixture.ipa',
    metadata: {
      softwareVersionExternalIdentifiers: [100, 101],
      bundleShortVersionString: '1.2.3', bundleVersion: '123',
      releaseDate: '2026-01-01T00:00:00Z',
    },
    sinfs: [{ id: 1, sinf: 'AQID' }],
  }],
};

const operations = [
  { name: 'version list', run: () => listVersions(account, app), hasVersion: false },
  { name: 'version details', run: () => getVersionMetadata(account, app, '101'), hasVersion: true },
  { name: 'download info', run: () => getDownloadInfo(account, app, '101'), hasVersion: true },
];

describe('historical version metadata', () => {
  beforeEach(() => vi.resetAllMocks());

  it.each(['2011-09-08T22:19:39Z', undefined, 'invalid-date'])('loads the version number independently of the app release date: %s', async (releaseDate) => {
    const metadata = { bundleShortVersionString: '16.25.1', ...(releaseDate === undefined ? {} : { releaseDate }) };
    vi.mocked(appleRequest).mockResolvedValueOnce(response({ status: 0, songList: [{ metadata }] }));
    const result = await getVersionMetadata(account, app, '101');
    expect(result.metadata).toEqual({ displayVersion: '16.25.1' });
  });
});

for (const operation of operations) {
  describe(`${operation.name} fallback`, () => {
    beforeEach(() => vi.resetAllMocks());

    it.each([
      { status: 0, jingleDocType: 'purchaseSuccess', songList: [] },
      { status: '0', songList: [] },
      { failureType: '5002' },
    ])('retries the supported response through redownload: %j', async (body) => {
      vi.mocked(appleRequest)
        .mockResolvedValueOnce(response(body))
        .mockResolvedValueOnce(response(success));
      const result = await operation.run();
      expect(appleRequest).toHaveBeenCalledTimes(2);
      const [primary, fallback] = vi.mocked(appleRequest).mock.calls.map(([request]) => request);
      expect(primary.host).toBe('p11-buy.itunes.apple.com');
      expect(fallback.host).toBe('downloaddispatch.itunes.apple.com');
      expect(fallback.path).toBe('/r/redownload?guid=aabbccddeeff');
      const firstBody = parsePlist(primary.body!);
      const nextBody = parsePlist(fallback.body!);
      expect(nextBody.salableAdamId).toBe(app.id);
      expect(nextBody.guid).toBe(account.deviceIdentifier);
      if (operation.hasVersion) {
        expect(firstBody.externalVersionId).toBe('101');
        expect(nextBody.appExtVrsId).toBe('101');
        expect(nextBody.externalVersionId).toBeUndefined();
      }
      if ('versions' in result) expect(result.versions).toEqual(['101', '100']);
      if ('metadata' in result) expect(result.metadata.displayVersion).toBe('1.2.3');
      if ('output' in result) expect(result.output.bundleShortVersionString).toBe('1.2.3');
      expect(account.cookies).toEqual([]);
    });

    it('keeps a successful primary response without another request', async () => {
      vi.mocked(appleRequest).mockResolvedValueOnce(response(success));
      await operation.run();
      expect(appleRequest).toHaveBeenCalledTimes(1);
    });

    it('stops after the fallback is also empty', async () => {
      vi.mocked(appleRequest).mockResolvedValue(response({ status: 0, songList: [] }));
      await expect(operation.run()).rejects.toThrow();
      expect(appleRequest).toHaveBeenCalledTimes(2);
    });

    it.each([
      { status: 200, body: { failureType: '9610', status: 0, songList: [] } },
      { status: 200, body: { failureType: '2034', status: 0, songList: [] } },
      { status: 403, body: { status: 0, songList: [] } },
      { status: 200, body: { status: -1, songList: [] } },
      { status: 200, body: { status: 0 } },
    ])('does not treat errors or malformed responses as empty success: %j', async ({ status, body }) => {
      vi.mocked(appleRequest).mockResolvedValue(response(body, status));
      await expect(operation.run()).rejects.toThrow();
      expect(appleRequest).toHaveBeenCalledTimes(1);
    });
  });
}
