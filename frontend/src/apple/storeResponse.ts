import i18n from '../i18n';
import { shouldRetryRedownload } from './config';
import { parsePlist } from './plist';
import type { AppleResponse } from './request';

export type StoreEndpointKind = 'volumeStore' | 'redownload' | 'updateProduct';

type StoreReply =
  | { action: 'fallback' }
  | { action: 'use'; data: Record<string, any> };

export function parseStoreResponse(
  response: AppleResponse,
  endpoint: StoreEndpointKind,
  canFallback: boolean,
): StoreReply {
  let data: Record<string, any>;
  try {
    const value: unknown = parsePlist(response.body);
    if (value === null || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
      throw new Error('Expected a plist dictionary');
    }
    data = value as Record<string, any>;
  } catch {
    if (canFallback && canRetryInvalidResponse(response.status)) return { action: 'fallback' };
    throw responseError(response, endpoint);
  }

  if (canFallback && shouldRetryRedownload(response.status, data)) return { action: 'fallback' };

  // Preserve structured Apple failure codes for each caller's existing account
  // and license error handling, but never accept other HTTP errors as success.
  if ((response.status < 200 || response.status >= 300) && !data.failureType) {
    throw responseError(response, endpoint);
  }
  return { action: 'use', data };
}

function canRetryInvalidResponse(status: number): boolean {
  return (status >= 200 && status < 300) || [500, 502, 503, 504].includes(status);
}

function responseError(response: AppleResponse, endpoint: StoreEndpointKind): Error {
  // No response body, cookies, redirects, account identifiers or arbitrary
  // header values belong in user-visible diagnostics.
  const mediaType = (response.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
  const safeMediaType = /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(mediaType) && mediaType.length <= 80 ? mediaType : '';
  const format = !response.body.trim() ? 'empty' : safeMediaType || 'non-plist';
  return new Error(i18n.t('errors.download.invalidResponse', {
    endpoint,
    status: response.status,
    format,
  }));
}
