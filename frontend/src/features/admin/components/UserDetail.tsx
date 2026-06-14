'use client';

import { useEffect, useState } from 'react';
import * as adminApi from '@/features/admin/services/adminApi';
import { ActivityFeed } from '@/features/admin/components/ActivityFeed';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Panel } from '@/components/ui/panel';
import { timeAgo } from '@/lib/utils';
import type { AdminUserDetail } from '@/types';

export function UserDetail({ userId }: { userId: string }) {
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => adminApi.getUser(userId).then(setDetail).catch((e) => setError(e.message));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function toggleSuspend() {
    if (!detail) return;
    const disabling = !detail.user.disabled;
    if (disabling && !confirm('Disable this user? Their sessions will be revoked and they cannot sign in.')) return;
    setBusy(true);
    try {
      if (disabling) await adminApi.suspendUser(userId, 'Disabled by admin');
      else await adminApi.unsuspendUser(userId);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (error) return <p className="font-mono text-sm text-danger">{error}</p>;
  if (!detail) return <p className="eyebrow text-muted-foreground">LOADING…</p>;
  const { user, sessions, apps, activity } = detail;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 border-2 border-border bg-card p-5 shadow-brutal-sm">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-heading text-xl font-bold text-foreground">{user.name}</p>
            {user.disabled ? <Badge tone="danger">Disabled</Badge> : <Badge tone="ok">Active</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
          <p className="eyebrow mt-2 text-muted-foreground">
            Role {user.role} · {user.disabled ? `disabled ${timeAgo(user.disabledAt)}` : 'active'} · joined {timeAgo(user.createdAt)}
          </p>
        </div>
        <Button
          variant={user.disabled ? 'secondary' : 'danger'}
          size="sm"
          disabled={busy}
          onClick={toggleSuspend}
        >
          {user.disabled ? 'Reinstate' : 'Disable user'}
        </Button>
      </div>

      <Panel label={`[ SESSIONS ] (${sessions.length})`}>
        {sessions.length === 0 ? (
          <div className="border-2 border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">No active sessions.</p>
          </div>
        ) : (
          <ul className="space-y-2 text-sm">
            {sessions.map((s) => (
              <li
                key={s.sid}
                className="border-2 border-border bg-card px-3 py-2 font-mono text-xs text-muted-foreground shadow-brutal-sm"
              >
                {s.ua || 'Unknown device'} · {s.ip || 'no ip'} · active {timeAgo(s.lastSeenAt)}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel label={`[ AUTHORIZED_APPS ] (${apps.length})`}>
        {apps.length === 0 ? (
          <div className="border-2 border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">No authorized apps.</p>
          </div>
        ) : (
          <ul className="space-y-2 text-sm">
            {apps.map((a) => (
              <li
                key={a.clientId}
                className="border-2 border-border bg-card px-3 py-2 font-mono text-xs text-muted-foreground shadow-brutal-sm"
              >
                {a.clientName} · {a.scope} · last used {timeAgo(a.lastUsedAt)}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel label="[ RECENT_ACTIVITY ]">
        <ActivityFeed events={activity} />
      </Panel>
    </div>
  );
}
