'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as adminApi from '@/features/admin/services/adminApi';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { SecretRevealOnce } from '@/features/admin/components/SecretRevealOnce';
import { timeAgo } from '@/lib/utils';
import type { AdminClient } from '@/types';
import { AlertTriangle, KeyRound } from 'lucide-react';

export function ClientsTable() {
  const router = useRouter();
  const [clients, setClients] = useState<AdminClient[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [rotated, setRotated] = useState<{ clientId: string; secret: string } | null>(null);

  // Modal states
  const [rotateTarget, setRotateTarget] = useState<AdminClient | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<AdminClient | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [suspendConfirmText, setSuspendConfirmText] = useState('');

  const load = () => adminApi.listClients().then(setClients).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  async function executeRotate() {
    if (!rotateTarget) return;
    setBusy(rotateTarget.clientId);
    try {
      const { clientSecret } = await adminApi.rotateSecret(rotateTarget.clientId);
      setRotated({ clientId: rotateTarget.clientId, secret: clientSecret });
      setRotateTarget(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function executeSuspend() {
    if (!suspendTarget) return;
    if (!suspendTarget.suspended && suspendConfirmText !== 'DELETE') return;
    setBusy(suspendTarget.clientId);
    try {
      await adminApi.setClientSuspended(
        suspendTarget.clientId,
        !suspendTarget.suspended,
        suspendTarget.suspended ? undefined : suspendReason.trim() || 'Suspended by admin',
      );
      setSuspendTarget(null);
      setSuspendReason('');
      setSuspendConfirmText('');
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
            onClick={() => router.push(`/admin/apps/${c.clientId}`)}
            className="group flex cursor-pointer items-start justify-between gap-4 border-2 border-border bg-card p-4 shadow-brutal-sm transition-all hover:-translate-y-0.5 hover:border-foreground/50 hover:shadow-brutal"
          >
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-medium text-foreground group-hover:underline">
                {c.clientName}
                {c.suspended && <Badge tone="danger">Suspended</Badge>}
              </p>
              <p className="mt-0.5 font-mono text-xs text-muted-foreground">{c.clientId}</p>
              <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{c.redirectUris.join(', ')}</p>
              <p className="eyebrow mt-1 text-muted-foreground">Created {timeAgo(c.createdAt)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={busy === c.clientId}
                onClick={(e) => {
                  e.stopPropagation();
                  setRotateTarget(c);
                }}
              >
                Rotate secret
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy === c.clientId}
                onClick={(e) => {
                  e.stopPropagation();
                  setSuspendReason('');
                  setSuspendConfirmText('');
                  setSuspendTarget(c);
                }}
              >
                {c.suspended ? 'Unsuspend' : 'Suspend'}
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {/* Rotate Secret Modal */}
      <Modal
        open={Boolean(rotateTarget)}
        onClose={() => !busy && setRotateTarget(null)}
        title="Rotate Client Secret"
      >
        {rotateTarget && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-warn/40 bg-warn/10 p-3.5 text-xs text-foreground">
              <AlertTriangle className="size-5 shrink-0 text-warn" />
              <p>
                Generating a new secret for <strong>{rotateTarget.clientName}</strong> immediately invalidates the existing secret. The new secret will be displayed <strong>once</strong>.
              </p>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="ghost"
                disabled={Boolean(busy)}
                onClick={() => setRotateTarget(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={Boolean(busy)}
                onClick={executeRotate}
              >
                {busy ? 'Generating…' : 'Generate New Secret'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Suspend / Unsuspend Modal */}
      <Modal
        open={Boolean(suspendTarget)}
        onClose={() => !busy && setSuspendTarget(null)}
        title={suspendTarget?.suspended ? 'Reactivate Application' : 'Suspend Application'}
      >
        {suspendTarget && (
          <div className="space-y-4">
            {suspendTarget.suspended ? (
              <p className="text-sm text-muted-foreground">
                Reactivate <strong>{suspendTarget.clientName}</strong> (<code className="font-mono text-xs">{suspendTarget.clientId}</code>)? User sign-in and token issuance will resume working immediately.
              </p>
            ) : (
              <>
                <div className="flex items-start gap-3 rounded-lg border border-danger/40 bg-danger/10 p-3.5 text-xs text-danger-foreground">
                  <AlertTriangle className="size-5 shrink-0 text-danger" />
                  <p>
                    Suspending <strong>{suspendTarget.clientName}</strong> will immediately refuse all authentication and token requests made using Client ID <code className="font-mono text-foreground font-semibold">{suspendTarget.clientId}</code>.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-mono font-bold uppercase text-muted-foreground mb-1.5">
                    Reason for suspension (Optional)
                  </label>
                  <Input
                    value={suspendReason}
                    onChange={(e) => setSuspendReason(e.target.value)}
                    placeholder="e.g. Terms of service violation, security investigation"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-mono text-muted-foreground">
                    To confirm suspension, please type <strong className="font-bold underline text-foreground">DELETE</strong> below:
                  </label>
                  <Input
                    value={suspendConfirmText}
                    onChange={(e) => setSuspendConfirmText(e.target.value)}
                    placeholder="Type 'DELETE' to confirm"
                    className="font-mono"
                  />
                </div>
              </>
            )}

            <div className="flex justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="ghost"
                disabled={Boolean(busy)}
                onClick={() => setSuspendTarget(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant={suspendTarget.suspended ? 'primary' : 'danger'}
                disabled={Boolean(busy) || (!suspendTarget.suspended && suspendConfirmText !== 'DELETE')}
                onClick={executeSuspend}
              >
                {busy
                  ? suspendTarget.suspended
                    ? 'Reactivating…'
                    : 'Suspending…'
                  : suspendTarget.suspended
                  ? 'Reactivate Application'
                  : 'Suspend Application'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
