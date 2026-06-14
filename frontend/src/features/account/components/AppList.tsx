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

  if (error) return <p className="font-mono text-sm text-danger">{error}</p>;
  if (!apps) return <p className="eyebrow text-muted-foreground">LOADING…</p>;
  if (apps.length === 0)
    return (
      <div className="border-2 border-dashed border-border p-8 text-center">
        <p className="text-sm text-muted-foreground">You haven&apos;t authorized any apps yet.</p>
      </div>
    );

  return (
    <ul className="space-y-3">
      {apps.map((app) => (
        <li
          key={app.clientId}
          className="flex items-center justify-between gap-4 border-2 border-border bg-card p-4 shadow-brutal-sm"
        >
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{app.clientName}</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {app.scope} · last used {timeAgo(app.lastUsedAt)}
            </p>
          </div>
          <Button
            variant="danger"
            size="sm"
            className="shrink-0"
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
