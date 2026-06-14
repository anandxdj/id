'use client';

import { useEffect, useState } from 'react';
import * as adminApi from '@/features/admin/services/adminApi';
import { ActivityFeed } from '@/features/admin/components/ActivityFeed';
import { SectionHeading } from '@/components/ui/section-heading';
import { Panel } from '@/components/ui/panel';
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

  if (error) return <p className="font-mono text-sm text-danger">{error}</p>;
  if (!metrics) return <p className="eyebrow text-muted-foreground">LOADING…</p>;

  return (
    <section className="space-y-8">
      <SectionHeading
        eyebrow="[ 00_DASHBOARD ]"
        title="Overview"
        description="System metrics and recent activity across all users and apps."
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {METRIC_CARDS.map((c) => (
          <div key={c.key} className="border-2 border-border bg-card p-4 shadow-brutal-sm">
            <p className="font-heading text-3xl font-bold text-foreground">{metrics[c.key]}</p>
            <p className="eyebrow mt-1 text-muted-foreground">{c.label}</p>
          </div>
        ))}
      </div>
      <Panel label="[ RECENT_ACTIVITY ]">
        <ActivityFeed events={activity} />
      </Panel>
    </section>
  );
}
