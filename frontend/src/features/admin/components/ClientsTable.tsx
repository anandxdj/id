'use client';

import { useEffect, useState } from 'react';
import * as adminApi from '@/features/admin/services/adminApi';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

  if (error) return <p className="font-mono text-sm text-danger">{error}</p>;
  if (!clients) return <p className="eyebrow text-muted-foreground">LOADING…</p>;
  if (clients.length === 0)
    return (
      <div className="border-2 border-dashed border-border p-8 text-center">
        <p className="text-sm text-muted-foreground">No apps registered yet.</p>
      </div>
    );

  return (
    <div className="space-y-4">
      {rotated && (
        <SecretRevealOnce label={`New secret for ${rotated.clientId}`} value={rotated.secret} />
      )}
      <ul className="space-y-3">
        {clients.map((c) => (
          <li
            key={c.clientId}
            className="flex items-start justify-between gap-4 border-2 border-border bg-card p-4 shadow-brutal-sm"
          >
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-medium text-foreground">
                {c.clientName}
                {c.suspended && <Badge tone="danger">Suspended</Badge>}
              </p>
              <p className="mt-0.5 font-mono text-xs text-muted-foreground">{c.clientId}</p>
              <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{c.redirectUris.join(', ')}</p>
              <p className="eyebrow mt-1 text-muted-foreground">Created {timeAgo(c.createdAt)}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={busy === c.clientId}
                onClick={() => rotate(c.clientId)}
              >
                Rotate secret
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy === c.clientId}
                onClick={() => toggleSuspend(c)}
              >
                {c.suspended ? 'Unsuspend' : 'Suspend'}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
