'use client';

import { useEffect, useState } from 'react';
import * as adminApi from '@/features/admin/services/adminApi';
import { ActivityFeed } from '@/features/admin/components/ActivityFeed';
import { Button } from '@/components/ui/button';
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

  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!detail) return <p className="text-sm text-white/40">Loading…</p>;
  const { user, sessions, apps, activity } = detail;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <div>
          <p className="text-lg font-semibold text-white">{user.name}</p>
          <p className="text-sm text-white/60">{user.email}</p>
          <p className="mt-1 text-xs text-white/40">
            Role {user.role} · {user.disabled ? `disabled ${timeAgo(user.disabledAt)}` : 'active'} · joined {timeAgo(user.createdAt)}
          </p>
        </div>
        <Button
          variant={user.disabled ? 'secondary' : 'primary'}
          className="h-9 px-3 text-xs"
          disabled={busy}
          onClick={toggleSuspend}
        >
          {user.disabled ? 'Reinstate' : 'Disable user'}
        </Button>
      </div>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-white/80">Sessions ({sessions.length})</h3>
        {sessions.length === 0 ? (
          <p className="text-sm text-white/40">No active sessions.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {sessions.map((s) => (
              <li key={s.sid} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-white/70">
                {s.ua || 'Unknown device'} · {s.ip || 'no ip'} · active {timeAgo(s.lastSeenAt)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-white/80">Authorized apps ({apps.length})</h3>
        {apps.length === 0 ? (
          <p className="text-sm text-white/40">No authorized apps.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {apps.map((a) => (
              <li key={a.clientId} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-white/70">
                {a.clientName} · {a.scope} · last used {timeAgo(a.lastUsedAt)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-white/80">Recent activity</h3>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4">
          <ActivityFeed events={activity} />
        </div>
      </section>
    </div>
  );
}
