import { fetchStoreProduct } from './storeProduct';
import i18n from '../i18n';
import type { Account, Software, VersionMetadata } from '../types';

export async function getVersionMetadata(
  account: Account,
  app: Software,
  versionId: string,
): Promise<{
  metadata: VersionMetadata;
  updatedCookies: typeof account.cookies;
}> {
  const { data: dict, updatedCookies: cookies } = await fetchStoreProduct(account, app, versionId);

  const songList = dict.songList as Record<string, any>[] | undefined;
  if (!songList || songList.length === 0) {
    if (['2034', '2042'].includes(String(dict.failureType))) {
      throw new Error(i18n.t('errors.download.passwordExpired'));
    }
    const customerMessage = dict.customerMessage as string | undefined;
    throw new Error(customerMessage ?? "No items in response");
  }

  const item = songList[0];
  const itemMetadata = item.metadata as Record<string, any>;
  if (!itemMetadata) {
    throw new Error("Missing metadata");
  }

  const bundleShortVersionString =
    itemMetadata.bundleShortVersionString as string;
  if (!bundleShortVersionString) {
    throw new Error("Missing bundleShortVersionString");
  }

  // releaseDate describes the app's original release, not this historical build.
  // This endpoint does not provide a reliable per-version publication date.
  return {
    metadata: {
      displayVersion: bundleShortVersionString,
    },
    updatedCookies: cookies,
  };
}
