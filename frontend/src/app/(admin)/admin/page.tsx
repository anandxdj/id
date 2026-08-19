'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import * as adminApi from '@/features/admin/services/adminApi';
import { ADMIN_PAGE_SIZE } from '@/features/admin/services/adminApi';
import { ActivityFeed } from '@/features/admin/components/ActivityFeed';
import { Pagination } from '@/components/ui/pagination';
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
  return (
    <Suspense fallback={<p className="eyebrow text-muted-foreground">LOADING...</p>}>
      <AdminDashboardContent />
    </Suspense>
  );
}

function AdminDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawPage = Number(searchParams.get('page'));
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const after = searchParams.get('after') || undefined;
  const before = searchParams.get('before') || undefined;
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [previousCursor, setPreviousCursor] = useState<string | null>(null);
  const [metricsError, setMetricsError] = useState('');
  const [activityError, setActivityError] = useState('');
  const [activityLoading, setActivityLoading] = useState(true);

  useEffect(() => {
    adminApi.getMetrics().then(setMetrics).catch(() => setMetricsError('Metrics could not be loaded.'));
  }, []);

  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => {
        if (!active) return null;
        setActivityLoading(true);
        setActivityError('');
        return adminApi.getActivity({ limit: ADMIN_PAGE_SIZE, after, before });
      })
      .then((result) => {
        if (!active || !result) return;
        if (result.items.length === 0 && page > 1) {
          router.replace('/admin');
          return;
        }
        setActivity(result.items);
        setNextCursor(result.nextCursor);
        setPreviousCursor(result.previousCursor);
      })
      .catch(() => {
        if (active) setActivityError('Recent activity could not be loaded.');
      })
      .finally(() => {
        if (active) setActivityLoading(false);
      });

    return () => {
      active = false;
    };
  }, [after, before, page, router]);

  const navigate = useCallback((direction: 'previous' | 'next') => {
    const query = new URLSearchParams(searchParams.toString());
    if (direction === 'next' && nextCursor) {
      query.set('page', String(page + 1));
      query.set('after', nextCursor);
      query.delete('before');
    }
    if (direction === 'previous' && previousCursor) {
      const previousPage = Math.max(page - 1, 1);
      if (previousPage === 1) query.delete('page');
      else query.set('page', String(previousPage));
      query.set('before', previousCursor);
      query.delete('after');
    }
    router.push(`/admin?${query.toString()}`);
  }, [nextCursor, page, previousCursor, router, searchParams]);

  return (
    <section className="space-y-8">
      <SectionHeading
        eyebrow="[ 00_DASHBOARD ]"
        title="Overview"
        description="System metrics and recent activity across all users and apps."
      />

      {metricsError && <InlineError message={metricsError} />}
      {!metrics && !metricsError ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-label="Loading metrics">
          {METRIC_CARDS.map((card) => <div key={card.key} className="h-24 animate-pulse rounded-xl bg-muted" />)}
        </div>
      ) : metrics ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {METRIC_CARDS.map((card) => (
            <div key={card.key} className="rounded-xl border border-border/60 bg-card/70 p-4 shadow-brutal-sm">
              <p className="font-heading text-3xl font-bold text-foreground">{metrics[card.key]}</p>
              <p className="eyebrow mt-1 text-muted-foreground">{card.label}</p>
            </div>
          ))}
        </div>
      ) : null}

      <Panel label="[ RECENT_ACTIVITY ]">
        {activityError ? (
          <InlineError message={activityError} />
        ) : activityLoading ? (
          <div className="space-y-3" role="status">
            {[0, 1, 2, 3].map((item) => <div key={item} className="h-8 animate-pulse rounded-lg bg-muted" />)}
            <span className="sr-only">Loading activity</span>
          </div>
        ) : (
          <>
            <ActivityFeed events={activity} />
            <Pagination
              page={page}
              pageSize={ADMIN_PAGE_SIZE}
              count={activity.length}
              hasPrevious={Boolean(previousCursor)}
              hasNext={Boolean(nextCursor)}
              onPrevious={() => navigate('previous')}
              onNext={() => navigate('next')}
              noun="events"
            />
          </>
        )}
      </Panel>
    </section>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <div role="alert" className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm text-muted-foreground">
      <AlertTriangle className="size-4 shrink-0 text-danger" aria-hidden="true" />
      {message}
    </div>
  );
}
