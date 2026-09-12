import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDownloadInfo } from '../../src/apple/download';
import { buildPlist, parsePlist } from '../../src/apple/plist';
import { getCurrentVersionId } from '../../src/apple/currentVersion';
import { appleRequest } from '../../src/apple/request';
import { listVersions } from '../../src/apple/versionFinder';
import { getVersionMetadata } from '../../src/apple/versionLookup';
import type { Account, Software } from '../../src/types';

vi.mock('../../src/apple/currentVersion', () => ({ getCurrentVersionId: vi.fn() }));

vi.mock('../../src/apple/request', () => ({ appleRequest: vi.fn() }));

const account = {
  email: 'fixture@example.com', password: '', appleId: 'fixture',
  store: '143465', firstName: '', lastName: '', passwordToken: 'fixture',
  directoryServicesIdentifier: '123', cookies: [],
  deviceIdentifier: 'aabbccddeeff', pod: '11',
} satisfies Account;
const app = { id: 461703208, bundleID: 'com.example.fixture' } as Software;

function response(body: Record<string, unknown>, status = 200) {
  return { status, statusText: 'OK', headers: {}, rawHeaders: [], body: buildPlist(body) };
}

const success = {
  status: 0,
  songList: [{
    URL: 'https://example.apple.com/fixture.ipa',
    metadata: {
      itemId: app.id, softwareVersionBundleId: app.bundleID, softwareVersionExternalIdentifier: 101,
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
  { name: 'latest download', run: () => getDownloadInfo(account, app), hasVersion: false },
  { name: 'download info', run: () => getDownloadInfo(account, app, '101'), hasVersion: true },
];

describe('historical version metadata', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.mocked(getCurrentVersionId).mockResolvedValue('101'); });

  it.each(['2011-09-08T22:19:39Z', undefined, 'invalid-date'])('loads the version number independently of the app release date: %s', async (releaseDate) => {
    const metadata = { bundleShortVersionString: '16.25.1', ...(releaseDate === undefined ? {} : { releaseDate }) };
    vi.mocked(appleRequest).mockResolvedValueOnce(response({ status: 0, songList: [{ metadata }] }));
    const result = await getVersionMetadata(account, app, '101');
    expect(result.metadata).toEqual({ displayVersion: '16.25.1' });
  });
});

for (const operation of operations) {
  describe(`${operation.name} fallback`, () => {
    beforeEach(() => { vi.resetAllMocks(); vi.mocked(getCurrentVersionId).mockResolvedValue('101'); });

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
      expect(firstBody.serialNumber).toBe('0');
      expect(nextBody.serialNumber).toBe('0');
      expect(primary.headers?.['X-Apple-Store-Front']).toBe(account.store);
      expect(primary.headers?.['X-Token']).toBe(account.passwordToken);
      expect(fallback.headers?.['X-Apple-Store-Front']).toBe(account.store);
      expect(fallback.headers?.['X-Token']).toBe(account.passwordToken);
      expect(nextBody.salableAdamId).toBe(app.id);
      expect(nextBody.guid).toBe(account.deviceIdentifier);
      expect(nextBody.appExtVrsId).toBe('101');
      expect(getCurrentVersionId).toHaveBeenCalledTimes(operation.hasVersion ? 0 : 1);
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

    it.each([
      { status: 200, body: '<html><body>Service unavailable</body></html>', type: 'text/html' },
      { status: 200, body: '', type: 'text/plain' },
      { status: 200, body: '<plist><string>unexpected</string></plist>', type: 'application/xml' },
      { status: 503, body: '<html><body>Service unavailable</body></html>', type: 'text/html' },
    ])('retries a primary response that cannot be decoded: $status $type', async ({ status, body, type }) => {
      vi.mocked(appleRequest)
        .mockResolvedValueOnce({ ...response({}, status), body, headers: { 'content-type': type } })
        .mockResolvedValueOnce(response(success));
      await operation.run();
      expect(appleRequest).toHaveBeenCalledTimes(2);
      const fallback = vi.mocked(appleRequest).mock.calls[1][0];
      expect(fallback.host).toBe('downloaddispatch.itunes.apple.com');
      const payload = parsePlist(fallback.body!);
      expect(payload.serialNumber).toBe('0');
      expect(payload.salableAdamId).toBe(app.id);
      if (operation.hasVersion) {
        expect(payload.appExtVrsId).toBe('101');
        expect(payload.externalVersionId).toBeUndefined();
      }
    });

    it('uses a pinned updateProduct request when redownload responds with an empty HTTP 500', async () => {
      vi.mocked(appleRequest)
        .mockResolvedValueOnce(response({ status: 0, songList: [] }))
        .mockResolvedValueOnce({ ...response({}, 500), body: '' })
        .mockResolvedValueOnce(response(success));
      const result = await operation.run();
      expect(appleRequest).toHaveBeenCalledTimes(3);
      const requests = vi.mocked(appleRequest).mock.calls.map(([request]) => request);
      expect(requests.map((request) => request.host)).toEqual([
        'p11-buy.itunes.apple.com',
        'downloaddispatch.itunes.apple.com',
        'downloaddispatch.itunes.apple.com',
      ]);
      const retryPayload = parsePlist(requests[2].body!);
      expect(retryPayload.serialNumber).toBe('0');
      expect(requests[2].path).toBe('/up/updateProduct?guid=aabbccddeeff');
      expect(retryPayload.appExtVrsId).toBe('101');
      expect(retryPayload.externalVersionId).toBeUndefined();
      if ('versions' in result) expect(result.versions).toEqual(['101', '100']);
      if ('metadata' in result) expect(result.metadata.displayVersion).toBe('1.2.3');
      if ('output' in result) expect(result.output.bundleShortVersionString).toBe('1.2.3');
    });

    it('reports the updateProduct error without retrying again', async () => {
      vi.mocked(appleRequest)
        .mockResolvedValueOnce(response({ failureType: '5002' }))
        .mockResolvedValueOnce({ ...response({}, 500), body: '' })
        .mockResolvedValue({ ...response({}, 503), body: '<html>private-token@example.test</html>', headers: { 'content-type': 'text/html; charset=utf-8' } });
      const error = await operation.run().catch((cause: Error) => cause);
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('updateProduct');
      expect((error as Error).message).toContain('HTTP 503');
      expect((error as Error).message).toContain('text/html');
      expect((error as Error).message).not.toContain('private-token');
      expect(appleRequest).toHaveBeenCalledTimes(3);
    });

    it.each([
      { status: 500, body: '<html>maintenance</html>' },
      { status: 503, body: '' },
      { status: 403, body: '' },
      { status: 429, body: '' },
    ])('does not use updateProduct for other redownload failures: $status', async ({ status, body }) => {
      vi.mocked(appleRequest)
        .mockResolvedValueOnce(response({ status: 0, songList: [] }))
        .mockResolvedValueOnce({ ...response({}, status), body });
      await expect(operation.run()).rejects.toThrow(`HTTP ${status}`);
      expect(appleRequest).toHaveBeenCalledTimes(2);
    });

    it('carries response cookies through redirects and the update fallback', async () => {
      vi.mocked(appleRequest)
        .mockResolvedValueOnce({ ...response({}, 302), headers: { location: 'https://p12-buy.itunes.apple.com/product' }, rawHeaders: [['set-cookie', 'store-cookie=rotated; Domain=.itunes.apple.com; Path=/; Secure']] })
        .mockResolvedValueOnce(response({ status: 0, songList: [] }))
        .mockResolvedValueOnce({ ...response({}, 500), body: '' })
        .mockResolvedValueOnce(response(success));
      const result = await operation.run();
      const requests = vi.mocked(appleRequest).mock.calls.map(([request]) => request);
      expect(requests[1].host).toBe('p12-buy.itunes.apple.com');
      expect(requests[3].cookies).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'store-cookie', value: 'rotated' })]));
      expect(result.updatedCookies).toEqual(requests[3].cookies);
      expect(account.cookies).toEqual([]);
    });

    it('rejects a redirect to another host before sending account headers', async () => {
      vi.mocked(appleRequest).mockResolvedValueOnce({ ...response({}, 302), headers: { location: 'https://example.com/collect' } });
      await expect(operation.run()).rejects.toThrow('Invalid Apple store redirect');
      expect(appleRequest).toHaveBeenCalledOnce();
    });

    it.each(['itemId', 'softwareVersionBundleId', 'softwareVersionExternalIdentifier'])('rejects an update response with mismatched %s', async (field) => {
      const invalid = structuredClone(success);
      (invalid.songList[0].metadata as Record<string, unknown>)[field] = 'other';
      vi.mocked(appleRequest)
        .mockResolvedValueOnce(response({ status: 0, songList: [] }))
        .mockResolvedValueOnce({ ...response({}, 500), body: '' })
        .mockResolvedValueOnce(response(invalid));
      await expect(operation.run()).rejects.toThrow('different app or version');
      expect(appleRequest).toHaveBeenCalledTimes(3);
    });

    it('does not request an unpinned fallback when current version resolution fails', async () => {
      if (operation.hasVersion) return;
      vi.mocked(appleRequest).mockResolvedValueOnce(response({ status: 0, songList: [] }));
      vi.mocked(getCurrentVersionId).mockRejectedValueOnce(new Error('Catalog unavailable'));
      await expect(operation.run()).rejects.toThrow('Catalog unavailable');
      expect(appleRequest).toHaveBeenCalledOnce();
    });

    it.each([401, 403, 429])('reports HTTP %i without retrying a non-plist denial', async (status) => {
      vi.mocked(appleRequest).mockResolvedValue({ ...response({}, status), body: '<html>Denied</html>' });
      await expect(operation.run()).rejects.toThrow(`HTTP ${status}`);
      expect(appleRequest).toHaveBeenCalledOnce();
    });

    it('keeps a successful primary response without another request', async () => {
      vi.mocked(appleRequest).mockResolvedValueOnce(response(success));
      await operation.run();
      expect(appleRequest).toHaveBeenCalledTimes(1);
    });

    it('surfaces an explicit Apple message without fallback', async () => {
      vi.mocked(appleRequest).mockResolvedValue(response({
        status: 0,
        songList: [],
        customerMessage: 'Fixture is not available in this storefront',
      }));
      await expect(operation.run()).rejects.toThrow('Fixture is not available in this storefront');
      expect(appleRequest).toHaveBeenCalledTimes(1);
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
