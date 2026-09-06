import { useEffect, useRef, useState } from 'react';
import { mergeCookies } from '../apple/cookies';
import { listVersions } from '../apple/versionFinder';
import { getVersionMetadata } from '../apple/versionLookup';
import { cacheVersionMetadata, isVersionMetadataFresh, readVersionMetadataCache } from '../utils/versionMetadataCache';
import type { CachedVersionMetadata } from '../utils/versionMetadataCache';
import type { Account, Cookie, Software } from '../types';

export const VERSION_PAGE_SIZE = 20;
const METADATA_LOAD_DELAY_MS = 350;

// Mount a fresh hook instance when the app or account identity changes.
export function useVersionHistory(
  app: Software,
  account: Account,
  updateAccount: (account: Account) => Promise<void>,
) {
  const latest = useRef({ account, updateAccount });
  latest.current = { account, updateAccount };
  const queue = useRef(Promise.resolve());
  const [versions, setVersions] = useState<string[]>([]);
  const [metadata, setMetadata] = useState<Record<string, CachedVersionMetadata>>(
    () => readVersionMetadataCache(app.id, account.store),
  );
  const metadataRef = useRef(metadata);
  const [failed, setFailed] = useState<string[]>([]);
  const failedRef = useRef(new Set<string>());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [retryRevision, setRetryRevision] = useState(0);

  async function saveCookies(requestAccount: Account, cookies: Cookie[]) {
    const current = latest.current.account;
    if (current.passwordToken !== requestAccount.passwordToken) return;
    // Apply only changes from this response so unrelated account edits survive.
    const changed = cookies.filter((cookie) => !requestAccount.cookies.some(
      (old) => JSON.stringify(old) === JSON.stringify(cookie),
    ));
    if (changed.length === 0) return;
    const updated = { ...current, cookies: mergeCookies(current.cookies, changed) };
    await latest.current.updateAccount(updated);
    latest.current.account = updated;
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setVersions([]);
    setPage(0);
    failedRef.current.clear();
    setFailed([]);
    // Serialize list refreshes and metadata lookups, including across page changes.
    queue.current = queue.current.then(async () => {
      if (!active) return;
      try {
        const requestAccount = latest.current.account;
        const result = await listVersions(requestAccount, app);
        if (!active) return;
        await saveCookies(requestAccount, result.updatedCookies);
        if (active) setVersions([...new Set(result.versions)]);
      } catch (cause) {
        if (active) setError(cause);
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => { active = false; };
  }, [revision]);

  useEffect(() => {
    let active = true;
    const visibleVersions = versions.slice(page * VERSION_PAGE_SIZE, (page + 1) * VERSION_PAGE_SIZE);
    // A long-lived tab must not reuse expired labels from its in-memory state.
    metadataRef.current = Object.fromEntries(Object.entries(metadataRef.current)
      .filter(([, value]) => isVersionMetadataFresh(value)));
    setMetadata(metadataRef.current);
    const loadVisibleMetadata = async () => {
      for (const versionId of visibleVersions) {
        if (!active) return;
        if (isVersionMetadataFresh(metadataRef.current[versionId]) || failedRef.current.has(versionId)) continue;
        try {
          const requestAccount = latest.current.account;
          const result = await getVersionMetadata(requestAccount, app, versionId);
          if (!active) return;
          await saveCookies(requestAccount, result.updatedCookies);
          if (!active) return;
          const cached = cacheVersionMetadata(app.id, account.store, versionId, result.metadata);
          metadataRef.current = { ...metadataRef.current, [versionId]: cached };
          setMetadata(metadataRef.current);
        } catch {
          if (!active) return;
          failedRef.current.add(versionId);
          setFailed([...failedRef.current]);
        }
      }
    };
    // Wait until paging settles so intermediate pages never start their lookups.
    const timer = window.setTimeout(() => {
      if (active) queue.current = queue.current.then(loadVisibleMetadata);
    }, METADATA_LOAD_DELAY_MS);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [versions, page, revision, retryRevision]);

  function retryMetadata(versionId: string) {
    failedRef.current.delete(versionId);
    setFailed([...failedRef.current]);
    setRetryRevision((value) => value + 1);
  }

  return {
    versions,
    visibleVersions: versions.slice(page * VERSION_PAGE_SIZE, (page + 1) * VERSION_PAGE_SIZE),
    metadata,
    failed,
    loading,
    error,
    page,
    pageCount: Math.ceil(versions.length / VERSION_PAGE_SIZE),
    setPage,
    refresh: () => setRevision((value) => value + 1),
    retryMetadata,
  };
}
