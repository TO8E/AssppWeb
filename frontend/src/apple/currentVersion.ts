import { storeIdToCountry } from './config';
import { appleRequest } from './request';
import type { Account, Software } from '../types';

function versionId(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return;
  const id = String(value);
  return /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id)) ? id : undefined;
}

async function publicJSON(host: string, path: string): Promise<any> {
  // Catalog requests need no Apple account headers or cookies.
  const response = await appleRequest({ method: 'GET', host, path, headers: { Accept: 'application/json' } });
  if (response.status !== 200) {
    throw new Error(`Apple catalog request failed (HTTP ${response.status})`);
  }
  try {
    return JSON.parse(response.body);
  } catch {
    throw new Error('Apple catalog returned invalid JSON');
  }
}

// Based on HaughtyEyes/ipatool's same-storefront iOS version selection:
// 1ecaec4 and da5ad04. This resolves a current ID, not the historical list.
export async function getCurrentVersionId(account: Account, app: Software): Promise<string> {
  const store = (account.storeFront || account.store).split('-')[0];
  const country = storeIdToCountry(store)?.toLowerCase();
  if (!country) throw new Error('Cannot resolve the account storefront');

  const params = new URLSearchParams({
    version: '2', id: String(app.id), p: 'mdm-lockup', caller: 'MDM',
    platform: 'enterprisestore', cc: country, l: 'en',
  });
  const catalog = await publicJSON('uclient-api.itunes.apple.com', `/WebObjects/MZStorePlatform.woa/wa/lookup?${params}`);
  const item = catalog.results?.[String(app.id)];
  if (item?.bundleId && app.bundleID && item.bundleId !== app.bundleID) {
    throw new Error('Apple catalog returned a different app');
  }
  const offer = item?.offers?.[0];
  const current = versionId(offer?.version?.externalId)
    ?? versionId(new URLSearchParams(offer?.buyParams ?? '').get('appExtVrsId'));
  if (current) return current;

  // Only a successful but incomplete MDM result uses the website fallback.
  // Never hide HTTP/transport failures or silently change the storefront.
  const website = await publicJSON('apps.apple.com',
    `/api/apps/v1/catalog/${country}/apps/${app.id}?platform=web&additionalPlatforms=iphone,ipad&l=en-GB`);
  const matches = Array.isArray(website.data)
    ? website.data.filter((entry: any) => String(entry.id) === String(app.id)) : [];
  const record = matches.length === 1 ? matches[0] : undefined;
  const ios = record?.attributes?.platformAttributes?.ios;
  if (record?.type !== 'apps' || !ios?.bundleId || (app.bundleID && ios.bundleId !== app.bundleID)) {
    throw new Error('Apple catalog returned no matching iOS app');
  }
  const id = versionId(ios.externalVersionId);
  if (!id) throw new Error('Apple catalog returned no current iOS version ID');
  return id;
}
