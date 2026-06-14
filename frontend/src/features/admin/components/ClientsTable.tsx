'use client';

import { useEffect, useState } from 'react';
import * as adminApi from '@/features/admin/services/adminApi';
import { Button } from '@/components/ui/button';
import { SecretRevealOnce } from '@/features/admin/components/SecretRevealOnce';
import { timeAgo } from '@/lib/utils';
import type { AdminClient } from '@/types';

export function ClientsTable() {
  const [clients, setClients] = useState<AdminClient[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [rotated, setRotated] = useState<{ clientId: string; secret: string } | null>(null);

  const load = () => adminApi.listClients().then(setClients).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  async function rotate(clientId: string) {
    if (!confirm('Rotate this client’s secret? The current secret stops working immediately.')) return;
    setBusy(clientId);
    try {
      const { clientSecret } = await adminApi.rotateSecret(clientId);
      setRotated({ clientId, secret: clientSecret });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function toggleSuspend(c: AdminClient) {
    setBusy(c.clientId);
    try {
      await adminApi.setClientSuspended(c.clientId, !c.suspended, c.suspended ? undefined : 'Suspended by admin');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!clients) return <p className="text-sm text-white/40">Loading…</p>;
  if (clients.length === 0) return <p className="text-sm text-white/40">No apps registered yet.</p>;

  return (
    <div className="space-y-4">
      {rotated && (
        <SecretRevealOnce label={`New secret for ${rotated.clientId}`} value={rotated.secret} />
      )}
      <ul className="space-y-3">
        {clients.map((c) => (
          <li key={c.clientId} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium text-white">
                  {c.clientName}
                  {c.suspended && (
                    <span className="ml-2 rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-300">Suspended</span>
                  )}
                </p>
                <p className="mt-0.5 font-mono text-xs text-white/40">{c.clientId}</p>
                <p className="mt-1 truncate text-xs text-white/40">{c.redirectUris.join(', ')}</p>
                <p className="mt-1 text-xs text-white/30">Created {timeAgo(c.createdAt)}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  variant="secondary"
                  className="h-8 px-3 text-xs"
                  disabled={busy === c.clientId}
                  onClick={() => rotate(c.clientId)}
                >
                  Rotate secret
                </Button>
                <Button
                  variant="ghost"
                  className="h-8 px-3 text-xs"
                  disabled={busy === c.clientId}
                  onClick={() => toggleSuspend(c)}
                >
                  {c.suspended ? 'Unsuspend' : 'Suspend'}
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
