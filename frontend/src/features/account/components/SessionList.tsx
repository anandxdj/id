'use client';

import { useEffect, useState } from 'react';
import * as accountApi from '@/features/account/services/accountApi';
import { Button } from '@/components/ui/button';
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

  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!sessions) return <p className="text-sm text-white/40">Loading…</p>;

  const others = sessions.filter((s) => !s.current).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/60">{sessions.length} active session{sessions.length === 1 ? '' : 's'}</p>
        <Button variant="secondary" className="h-9 px-3 text-xs" disabled={busy || others === 0} onClick={revokeAll}>
          Sign out everywhere else
        </Button>
      </div>
      <ul className="space-y-3">
        {sessions.map((s) => (
          <li
            key={s.sid}
            className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4"
          >
            <div className="min-w-0">
              <p className="truncate text-sm text-white">
                {s.ua || 'Unknown device'}
                {s.current && <span className="ml-2 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-300">This device</span>}
              </p>
              <p className="mt-0.5 text-xs text-white/40">
                {s.ip || 'no ip'} · active {timeAgo(s.lastSeenAt)}
              </p>
            </div>
            {!s.current && (
              <Button variant="ghost" className="h-9 px-3 text-xs" disabled={busy} onClick={() => revoke(s.sid)}>
                Revoke
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
