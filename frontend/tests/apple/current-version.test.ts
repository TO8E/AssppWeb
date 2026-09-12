import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCurrentVersionId } from '../../src/apple/currentVersion';
import { appleRequest } from '../../src/apple/request';
import type { Account, Software } from '../../src/types';

vi.mock('../../src/apple/request', () => ({ appleRequest: vi.fn() }));
const account = { store: '143465', storeFront: '143465-19,34' } as Account;
const app = { id: 461703208, bundleID: 'com.autonavi.amap' } as Software;
const response = (data: unknown, status = 200) => ({ status, statusText: '', headers: {}, rawHeaders: [], body: JSON.stringify(data) });
const catalog = (offer: unknown) => ({ results: { [app.id]: { bundleId: app.bundleID, offers: [offer] } } });
const website = (ios: unknown) => ({ data: [{ id: String(app.id), type: 'apps', attributes: { platformAttributes: { ios } } }] });

describe('current iOS version selection', () => {
  beforeEach(() => vi.resetAllMocks());

  it.each([890933327, '890933327'])('reads the same-storefront MDM ID: %s', async (id) => {
    vi.mocked(appleRequest).mockResolvedValueOnce(response(catalog({ version: { externalId: id } })));
    expect(await getCurrentVersionId(account, app)).toBe('890933327');
    const request = vi.mocked(appleRequest).mock.calls[0][0];
    expect(request.host).toBe('uclient-api.itunes.apple.com');
    const query = new URL(`https://${request.host}${request.path}`).searchParams;
    expect(query.get('cc')).toBe('cn');
    expect(query.get('platform')).toBe('enterprisestore');
    expect(query.get('id')).toBe(String(app.id));
    expect(request.cookies).toBeUndefined();
    expect(request.headers).toEqual({ Accept: 'application/json' });
  });

  it('accepts buyParams when the version object is omitted', async () => {
    vi.mocked(appleRequest).mockResolvedValueOnce(response(catalog({ buyParams: 'price=0&appExtVrsId=890933327' })));
    expect(await getCurrentVersionId({ ...account, storeFront: undefined }, app)).toBe('890933327');
  });

  it.each([{ results: {} }, catalog({})])('uses the website only when MDM has no usable ID', async (data) => {
    vi.mocked(appleRequest)
      .mockResolvedValueOnce(response(data))
      .mockResolvedValueOnce(response(website({ bundleId: app.bundleID, externalVersionId: 890933327 })));
    expect(await getCurrentVersionId(account, app)).toBe('890933327');
    const request = vi.mocked(appleRequest).mock.calls[1][0];
    expect(request.host).toBe('apps.apple.com');
    expect(request.path).toContain(`/catalog/cn/apps/${app.id}?`);
    expect(request.cookies).toBeUndefined();
    expect(request.headers).toEqual({ Accept: 'application/json' });
  });

  it.each([403, 429, 500])('does not hide a catalog HTTP %i with another source', async (status) => {
    vi.mocked(appleRequest).mockResolvedValueOnce(response({}, status));
    await expect(getCurrentVersionId(account, app)).rejects.toThrow(`HTTP ${status}`);
    expect(appleRequest).toHaveBeenCalledOnce();
  });

  it('rejects an unknown storefront without assuming US', async () => {
    await expect(getCurrentVersionId({ ...account, store: '', storeFront: undefined }, app)).rejects.toThrow('storefront');
    expect(appleRequest).not.toHaveBeenCalled();
  });

  it.each([
    { data: [] },
    website(undefined),
    website({ bundleId: 'com.other', externalVersionId: 123 }),
    website({ bundleId: app.bundleID, externalVersionId: 0 }),
    website({ bundleId: app.bundleID, externalVersionId: 'abc' }),
    { data: [...website({}).data, ...website({}).data] },
  ])('rejects missing, ambiguous, or mismatched website results', async (data) => {
    vi.mocked(appleRequest).mockResolvedValueOnce(response({ results: {} })).mockResolvedValueOnce(response(data));
    await expect(getCurrentVersionId(account, app)).rejects.toThrow();
    expect(appleRequest).toHaveBeenCalledTimes(2);
  });
});
