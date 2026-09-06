import { useEffect, useState } from 'react';
import { accountRouteId } from '../utils/account';
import type { Account } from '../types';

// Use an opaque identifier for the IndexedDB record key without changing records.
export function useAccountRoutes(accounts: Account[], enabled: boolean) {
  const key = JSON.stringify(accounts.map((account) => account.email).sort());
  const [resolved, setResolved] = useState<{ key: string; ids: Record<string, string> }>({
    key: '', ids: {},
  });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const identities = JSON.parse(key) as string[];
    Promise.all(identities.map(async (email) => {
      const id = await accountRouteId(email);
      return [email, id] as const;
    })).then((entries) => {
      if (!cancelled) setResolved({ key, ids: Object.fromEntries(entries) });
    }).catch(() => {
      if (!cancelled) setResolved({ key, ids: {} });
    });
    return () => { cancelled = true; };
  }, [key, enabled]);

  return { ids: resolved.key === key ? resolved.ids : {}, loading: enabled && resolved.key !== key };
}
