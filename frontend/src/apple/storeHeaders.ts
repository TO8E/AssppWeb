import type { Account } from "../types";

export function authenticatedStoreHeaders(
  account: Account,
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/x-apple-plist",
    "iCloud-DSID": account.directoryServicesIdentifier,
    "X-Dsid": account.directoryServicesIdentifier,
  };

  const storeFront = account.storeFront || account.store;
  if (storeFront) headers["X-Apple-Store-Front"] = storeFront;
  if (account.passwordToken) headers["X-Token"] = account.passwordToken;

  return headers;
}
