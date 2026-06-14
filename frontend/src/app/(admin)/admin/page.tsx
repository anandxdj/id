'use client';

import { useEffect, useState } from 'react';
import * as adminApi from '@/features/admin/services/adminApi';
import { ActivityFeed } from '@/features/admin/components/ActivityFeed';
import type { AdminMetrics, ActivityEvent } from '@/types';

const METRIC_CARDS: { key: keyof AdminMetrics; label: string }[] = [
  { key: 'totalUsers', label: 'Users' },
  { key: 'activeUsers7d', label: 'Active (7d)' },
  { key: 'logins24h', label: 'Logins (24h)' },
  { key: 'disabledUsers', label: 'Disabled' },
  { key: 'totalClients', label: 'Apps' },
  { key: 'suspendedClients', label: 'Suspended apps' },
];

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([adminApi.getMetrics(), adminApi.getActivity({ limit: 30 })])
      .then(([m, a]) => {
        setMetrics(m);
        setActivity(a);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!metrics) return <p className="text-sm text-white/40">Loading…</p>;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {METRIC_CARDS.map((c) => (
          <div key={c.key} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-2xl font-semibold text-white">{metrics[c.key]}</p>
            <p className="mt-1 text-xs text-white/50">{c.label}</p>
          </div>
        ))}
      </div>
      <section>
        <h2 className="mb-3 text-sm font-semibold text-white/80">Recent activity</h2>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4">
          <ActivityFeed events={activity} />
        </div>
      </section>
    </div>
  );
}
