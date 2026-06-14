'use client';

import { timeAgo } from '@/lib/utils';
import type { ActivityEvent } from '@/types';

const TYPE_COLOR: Record<string, string> = {
  'login.success': 'text-ok',
  'login.fail': 'text-danger',
  'token.issued': 'text-muted-foreground',
  'consent.granted': 'text-ok',
  'consent.revoked': 'text-warn',
};

const typeColor = (t: string) =>
  TYPE_COLOR[t] ?? (t.startsWith('admin.') ? 'text-warn' : 'text-muted-foreground');

export function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0)
    return <p className="text-sm text-muted-foreground">No activity recorded.</p>;
  return (
    <ul className="divide-y divide-border text-sm">
      {events.map((e) => (
        <li key={e._id} className="flex items-center justify-between gap-4 py-2.5">
          <div className="min-w-0">
            <span className={`font-mono text-xs font-bold ${typeColor(e.type)}`}>{e.type}</span>
            <span className="ml-2 font-mono text-xs text-muted-foreground">
              {e.clientId ? `client ${e.clientId}` : ''}
              {e.ip ? ` · ${e.ip}` : ''}
            </span>
          </div>
          <span className="shrink-0 font-mono text-xs text-muted-foreground">{timeAgo(e.createdAt)}</span>
        </li>
      ))}
    </ul>
  );
}
