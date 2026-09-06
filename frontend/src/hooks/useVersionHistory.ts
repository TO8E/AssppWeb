import { useEffect, useRef, useState } from 'react';
import { useSettingsStore } from '../store/settings';
import { mergeCookies } from '../apple/cookies';
import { listVersions } from '../apple/versionFinder';
import { getVersionMetadata } from '../apple/versionLookup';
import { cacheVersionMetadata, isVersionMetadataFresh, readVersionMetadataCache } from '../utils/versionMetadataCache';
import type { CachedVersionMetadata } from '../utils/versionMetadataCache';
import type { Account, Cookie, Software } from '../types';

export const VERSION_PAGE_SIZE = 20;
const METADATA_LOAD_DELAY_MS = 350;
type MetadataScope = { active: boolean };

// Mount a fresh hook instance when the app or account identity changes.
export function useVersionHistory(
  app: Software,
  account: Account,
  updateAccount: (account: Account) => Promise<void>,
) {
  const autoFetchVersionNumbers = useSettingsStore((state) => state.autoFetchVersionNumbers);
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
  const metadataScope = useRef<MetadataScope>({ active: false });
  const pendingMetadata = useRef(new Set<string>());
  const [loadingMetadata, setLoadingMetadata] = useState<string[]>([]);

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

  async function loadMetadata(versionId: string, scope: MetadataScope) {
    if (!scope.active) return;
    try {
      if (isVersionMetadataFresh(metadataRef.current[versionId])) return;
      const requestAccount = latest.current.account;
      const result = await getVersionMetadata(requestAccount, app, versionId);
      if (!scope.active) return;
      await saveCookies(requestAccount, result.updatedCookies);
      if (!scope.active) return;
      const cached = cacheVersionMetadata(app.id, account.store, versionId, result.metadata);
      metadataRef.current = { ...metadataRef.current, [versionId]: cached };
      setMetadata(metadataRef.current);
    } catch {
      if (!scope.active) return;
      failedRef.current.add(versionId);
      setFailed([...failedRef.current]);
    } finally {
      if (scope.active) {
        pendingMetadata.current.delete(versionId);
        setLoadingMetadata([...pendingMetadata.current]);
      }
    }
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
    const scope = { active: true };
    metadataScope.current = scope;
    pendingMetadata.current.clear();
    setLoadingMetadata([]);
    if (!autoFetchVersionNumbers) setPage(0);
    const visibleVersions = autoFetchVersionNumbers
      ? versions.slice(page * VERSION_PAGE_SIZE, (page + 1) * VERSION_PAGE_SIZE)
      : versions;
    // A long-lived tab must not reuse expired labels from its in-memory state.
    metadataRef.current = Object.fromEntries(Object.entries(metadataRef.current)
      .filter(([, value]) => isVersionMetadataFresh(value)));
    setMetadata(metadataRef.current);
    const loadVisibleMetadata = async () => {
      for (const versionId of visibleVersions) {
        if (!scope.active) return;
        if (isVersionMetadataFresh(metadataRef.current[versionId]) || failedRef.current.has(versionId) || pendingMetadata.current.has(versionId)) continue;
        pendingMetadata.current.add(versionId);
        setLoadingMetadata([...pendingMetadata.current]);
        await loadMetadata(versionId, scope);
      }
    };
    // Wait until paging settles so intermediate pages never start their lookups.
    const timer = autoFetchVersionNumbers ? window.setTimeout(() => {
      if (scope.active) queue.current = queue.current.then(loadVisibleMetadata);
    }, METADATA_LOAD_DELAY_MS) : undefined;
    return () => {
      scope.active = false;
      window.clearTimeout(timer);
    };
  }, [versions, page, revision, autoFetchVersionNumbers]);

  function requestMetadata(versionId: string) {
    const scope = metadataScope.current;
    if (!scope.active || pendingMetadata.current.has(versionId) || isVersionMetadataFresh(metadataRef.current[versionId])) return;
    failedRef.current.delete(versionId);
    setFailed([...failedRef.current]);
    pendingMetadata.current.add(versionId);
    setLoadingMetadata([...pendingMetadata.current]);
    // Manual requests share the queue without interrupting another requested row.
    queue.current = queue.current.then(() => loadMetadata(versionId, scope));
  }

  return {
    versions,
    visibleVersions: autoFetchVersionNumbers
      ? versions.slice(page * VERSION_PAGE_SIZE, (page + 1) * VERSION_PAGE_SIZE)
      : versions,
    metadata,
    autoFetchVersionNumbers,
    loadingMetadata,
    failed,
    loading,
    error,
    page,
    pageCount: autoFetchVersionNumbers ? Math.ceil(versions.length / VERSION_PAGE_SIZE) : 1,
    setPage,
    refresh: () => setRevision((value) => value + 1),
    requestMetadata,
  };
}
