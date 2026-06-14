'use client';

import { useEffect, useState } from 'react';
import * as accountApi from '@/features/account/services/accountApi';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { timeAgo } from '@/lib/utils';
import type { SessionView } from '@/types';

export function SessionList() {
  const [sessions, setSessions] = useState<SessionView[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => accountApi.listSessions().then(setSessions).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  async function revoke(sid: string) {
    setBusy(true);
    try {
      await accountApi.revokeSession(sid);
      setSessions((prev) => prev?.filter((s) => s.sid !== sid) ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function revokeAll() {
    if (!confirm('Sign out of all other sessions?')) return;
    setBusy(true);
    try {
      await accountApi.revokeAllSessions();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (error) return <p className="font-mono text-sm text-danger">{error}</p>;
  if (!sessions) return <p className="eyebrow text-muted-foreground">LOADING…</p>;

  const others = sessions.filter((s) => !s.current).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="eyebrow text-muted-foreground">
          {sessions.length} ACTIVE SESSION{sessions.length === 1 ? '' : 'S'}
        </p>
        <Button variant="secondary" size="sm" disabled={busy || others === 0} onClick={revokeAll}>
          Sign out everywhere else
        </Button>
      </div>
      <ul className="space-y-3">
        {sessions.map((s) => (
          <li
            key={s.sid}
            className="flex items-center justify-between gap-4 border-2 border-border bg-card p-4 shadow-brutal-sm"
          >
            <div className="min-w-0">
              <p className="flex items-center gap-2 truncate text-sm font-medium text-foreground">
                {s.ua || 'Unknown device'}
                {s.current && <Badge tone="ok">This device</Badge>}
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {s.ip || 'no ip'} · active {timeAgo(s.lastSeenAt)}
              </p>
            </div>
            {!s.current && (
              <Button variant="danger" size="sm" disabled={busy} onClick={() => revoke(s.sid)}>
                Revoke
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
