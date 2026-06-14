'use client';

import { timeAgo } from '@/lib/utils';
import type { ActivityEvent } from '@/types';

const TYPE_COLOR: Record<string, string> = {
  'login.success': 'text-emerald-300',
  'login.fail': 'text-red-300',
  'token.issued': 'text-sky-300',
  'consent.granted': 'text-violet-300',
  'consent.revoked': 'text-amber-300',
};

const typeColor = (t: string) =>
  TYPE_COLOR[t] ?? (t.startsWith('admin.') ? 'text-amber-300' : 'text-white/70');

export function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) return <p className="text-sm text-white/40">No activity recorded.</p>;
  return (
    <ul className="divide-y divide-white/5 text-sm">
      {events.map((e) => (
        <li key={e._id} className="flex items-center justify-between gap-4 py-2.5">
          <div className="min-w-0">
            <span className={`font-mono text-xs ${typeColor(e.type)}`}>{e.type}</span>
            <span className="ml-2 text-white/40">
              {e.clientId ? `client ${e.clientId}` : ''}
              {e.ip ? ` · ${e.ip}` : ''}
            </span>
          </div>
          <span className="shrink-0 text-xs text-white/40">{timeAgo(e.createdAt)}</span>
        </li>
      ))}
    </ul>
  );
}
