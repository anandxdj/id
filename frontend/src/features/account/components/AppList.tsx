'use client';

import { useEffect, useState } from 'react';
import * as accountApi from '@/features/account/services/accountApi';
import { Button } from '@/components/ui/button';
import { timeAgo } from '@/lib/utils';
import type { AuthorizedApp } from '@/types';

export function AppList() {
  const [apps, setApps] = useState<AuthorizedApp[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    accountApi.listApps().then(setApps).catch((e) => setError(e.message));
  }, []);

  async function revoke(clientId: string) {
    if (!confirm('Revoke access for this app? It will need your consent again next time.')) return;
    setBusy(clientId);
    try {
      await accountApi.revokeApp(clientId);
      setApps((prev) => prev?.filter((a) => a.clientId !== clientId) ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!apps) return <p className="text-sm text-white/40">Loading…</p>;
  if (apps.length === 0) return <p className="text-sm text-white/40">You haven&apos;t authorized any apps yet.</p>;

  return (
    <ul className="space-y-3">
      {apps.map((app) => (
        <li
          key={app.clientId}
          className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4"
        >
          <div className="min-w-0">
            <p className="truncate font-medium text-white">{app.clientName}</p>
            <p className="mt-0.5 text-xs text-white/40">
              Scopes: {app.scope} · Last used {timeAgo(app.lastUsedAt)}
            </p>
          </div>
          <Button
            variant="secondary"
            className="h-9 shrink-0 px-3 text-xs"
            disabled={busy === app.clientId}
            onClick={() => revoke(app.clientId)}
          >
            {busy === app.clientId ? 'Revoking…' : 'Revoke'}
          </Button>
        </li>
      ))}
    </ul>
  );
}
