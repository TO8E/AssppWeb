import { redownloadEndpoint, volumeStoreEndpoint } from './config';
import { getCurrentVersionId } from './currentVersion';
import { extractAndMergeCookies } from './cookies';
import { buildPlist } from './plist';
import { appleRequest } from './request';
import { authenticatedStoreHeaders } from './storeHeaders';
import { parseStoreResponse } from './storeResponse';
import type { StoreDownloadEndpoint } from './config';
import type { Account, Software } from '../types';

export async function fetchStoreProduct(account: Account, app: Software, explicitVersionId?: string) {
  const deviceId = account.deviceIdentifier;
  let cookies = [...account.cookies];

  async function request(endpoint: StoreDownloadEndpoint, id?: string) {
    let url = new URL(`https://${endpoint.host}${endpoint.path}`);
    const payload = {
      creditDisplay: '', guid: deviceId, salableAdamId: app.id, serialNumber: '0',
      ...(id ? { [endpoint.externalVersionIdKey]: id } : {}),
    };
    for (let attempt = 0; attempt <= 3; attempt++) {
      const response = await appleRequest({
        method: 'POST', host: url.hostname, path: url.pathname + url.search,
        headers: authenticatedStoreHeaders(account), body: buildPlist(payload), cookies,
      });
      cookies = extractAndMergeCookies(response.rawHeaders, cookies);
      if (response.status !== 302) return response;
      const location = response.headers.location;
      if (!location) throw new Error('Failed to retrieve redirect location');
      url = new URL(location, url);
      if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        !/^(?:p\d+-buy|buy|downloaddispatch)\.itunes\.apple\.com$/.test(url.hostname)) {
        throw new Error('Invalid Apple store redirect');
      }
    }
    throw new Error('Too many redirects');
  }

  const primary = parseStoreResponse(await request(volumeStoreEndpoint(account.pod, deviceId), explicitVersionId), 'volumeStore', true);
  if (primary.action === 'use') return { data: primary.data, updatedCookies: cookies };

  // Unpinned redownloads can be empty or select another platform. Preserve an
  // explicitly requested historical ID; resolve iOS only for latest/list calls.
  const id = explicitVersionId || await getCurrentVersionId(account, app);
  let response = await request(redownloadEndpoint(deviceId), id);
  let endpoint: 'redownload' | 'updateProduct' = 'redownload';
  // HaughtyEyes/ipatool 741049d: updateProduct serves pinned iOS requests when
  // redownload returns an empty 500. Do not retry other errors or buy a license.
  if (response.status === 500 && !response.body.trim()) {
    endpoint = 'updateProduct';
    response = await request({
      host: 'downloaddispatch.itunes.apple.com',
      path: `/up/updateProduct?guid=${deviceId}`, externalVersionIdKey: 'appExtVrsId',
    }, id);
  }
  const result = parseStoreResponse(response, endpoint, false);
  if (result.action !== 'use') throw new Error('Unexpected Apple fallback response');
  const data = result.data;
  if (!data.failureType && data.customerMessage) throw new Error(String(data.customerMessage));
  if (!data.failureType && Array.isArray(data.songList) && data.songList.length > 0) {
    const metadata = data.songList[0]?.metadata;
    if (data.songList.length !== 1 || String(metadata?.itemId) !== String(app.id) ||
      String(metadata?.softwareVersionExternalIdentifier) !== id || !metadata?.softwareVersionBundleId ||
      (app.bundleID && metadata.softwareVersionBundleId !== app.bundleID)) {
      throw new Error('Apple returned a different app or version');
    }
  }
  return { data, updatedCookies: cookies };
}
