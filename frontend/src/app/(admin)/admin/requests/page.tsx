'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock3,
  RefreshCw,
  ShieldCheck,
  UserRound,
  X,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { Textarea } from '@/components/ui/textarea';
import { ADMIN_PAGE_SIZE, AdminApi } from '@/features/admin/services/adminApi';
import { cn } from '@/lib/utils';
import type { AdminAccessQueueRequest, AdminAccessRequestStatus } from '@/types';

const STATUS_OPTIONS = [
  {
    value: 'pending' as const,
    label: 'Pending',
    description: 'Requests waiting for a decision.',
    emptyTitle: 'No pending requests',
    emptyDescription: 'New access requests will appear here when someone asks for elevated permissions.',
    Icon: Clock3,
  },
  {
    value: 'approved' as const,
    label: 'Approved',
    description: 'Requests that have been granted.',
    emptyTitle: 'No approved requests',
    emptyDescription: 'Approved access decisions will be recorded here for future reference.',
    Icon: CheckCircle2,
  },
  {
    value: 'rejected' as const,
    label: 'Rejected',
    description: 'Requests that were not granted.',
    emptyTitle: 'No rejected requests',
    emptyDescription: 'Rejected access decisions will be recorded here for future reference.',
    Icon: XCircle,
  },
] satisfies ReadonlyArray<{
  value: AdminAccessRequestStatus;
  label: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  Icon: typeof Clock3;
}>;

type ViewProps = {
  status: AdminAccessRequestStatus;
  setStatus(value: AdminAccessRequestStatus): void;
  page: number;
  setPage(value: number): void;
  total: number;
  requests: AdminAccessQueueRequest[];
  notes: Record<string, string>;
  setNotes(value: Record<string, string>): void;
  busy: string;
  setBusy(value: string): void;
  loading: boolean;
  error: string;
  setError(value: string): void;
  reload(): Promise<void>;
};

export default function AdminRequestsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <AdminRequestsContent />
    </Suspense>
  );
}

function AdminRequestsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawStatus = searchParams.get('status');
  const status: AdminAccessRequestStatus =
    rawStatus === 'approved' || rawStatus === 'rejected' ? rawStatus : 'pending';
  const rawPage = Number(searchParams.get('page'));
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const [requests, setRequests] = useState<AdminAccessQueueRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const updateQuery = useCallback((next: { status?: AdminAccessRequestStatus; page?: number }) => {
    const query = new URLSearchParams(searchParams.toString());
    if (next.status) query.set('status', next.status);
    const nextPage = next.page ?? page;
    if (nextPage > 1) query.set('page', String(nextPage));
    else query.delete('page');
    router.push(`/admin/requests?${query.toString()}`);
  }, [page, router, searchParams]);

  const changeStatus = useCallback((value: AdminAccessRequestStatus) => {
    updateQuery({ status: value, page: 1 });
  }, [updateQuery]);

  const load = useCallback(async () => {
    await Promise.resolve();
    setLoading(true);
    setError('');
    setRequests([]);

    try {
      const result = await AdminApi.listAdminAccessRequests({ status, page, limit: ADMIN_PAGE_SIZE });
      if (result.items.length === 0 && result.total > 0 && page > 1) {
        updateQuery({ page: page - 1 });
        return;
      }
      setRequests(result.items);
      setTotal(result.total);
    } catch {
      setError('We couldn’t load this request queue. Try again in a moment.');
    } finally {
      setLoading(false);
    }
  }, [page, status, updateQuery]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <RequestsView
      status={status}
      setStatus={changeStatus}
      page={page}
      setPage={(value) => updateQuery({ page: value })}
      total={total}
      requests={requests}
      notes={notes}
      setNotes={setNotes}
      busy={busy}
      setBusy={setBusy}
      loading={loading}
      error={error}
      setError={setError}
      reload={load}
    />
  );
}

function RequestsView(props: ViewProps) {
  const activeOption = STATUS_OPTIONS.find((option) => option.value === props.status) ?? STATUS_OPTIONS[0];
  const ActiveIcon = activeOption.Icon;

  return (
    <main className="space-y-7">
      <section className="relative overflow-hidden rounded-[1.75rem] border border-border/60 bg-card/60 p-5 shadow-brutal-sm backdrop-blur-md sm:p-7">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-brand/5 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute bottom-0 left-1/3 h-px w-1/3 bg-gradient-to-r from-transparent via-brand/30 to-transparent" />

        <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-brand/20 bg-brand/10 text-brand shadow-inner">
              <ShieldCheck className="size-6" strokeWidth={1.8} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="eyebrow text-muted-foreground">ACCESS CONTROL / REVIEW QUEUE</p>
              <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Admin access requests
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                Review requests for elevated permissions and keep administrative access intentional.
              </p>
            </div>
          </div>

          <div className="hidden shrink-0 items-center gap-2 rounded-full border border-border/60 bg-background/40 px-3 py-2 text-xs text-muted-foreground sm:flex">
            <ActiveIcon className="size-3.5 text-brand" aria-hidden="true" />
            <span className="font-mono uppercase tracking-[0.14em]">{activeOption.label} queue</span>
          </div>
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="request-status-heading">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p id="request-status-heading" className="eyebrow text-muted-foreground">FILTER BY STATUS</p>
            <p className="mt-1 text-sm text-muted-foreground">{activeOption.description}</p>
          </div>
          {!props.loading && !props.error && (
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground/70">
              {props.total} {props.total === 1 ? 'request' : 'requests'}
            </p>
          )}
        </div>

        <div role="tablist" aria-label="Access request status" className="grid grid-cols-3 gap-1 rounded-2xl border border-border/70 bg-card/50 p-1.5 shadow-brutal-xs">
          {STATUS_OPTIONS.map((option) => {
            const Icon = option.Icon;
            const active = props.status === option.value;

            return (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => props.setStatus(option.value)}
                className={cn(
                  'flex min-h-11 items-center justify-center gap-2 rounded-xl px-2 py-2.5 text-xs font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:gap-2.5 sm:px-4',
                  active
                    ? 'bg-foreground text-background shadow-md'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {props.error && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger/5 p-4 text-danger">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground">Requests unavailable</p>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">{props.error}</p>
          </div>
          <button
            type="button"
            onClick={() => void props.reload()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RefreshCw className="size-3.5" aria-hidden="true" />
            Retry
          </button>
        </div>
      )}

      <section id="admin-access-requests-panel" aria-live="polite" aria-busy={props.loading}>
        {props.loading ? (
          <LoadingState />
        ) : props.error ? null : props.requests.length > 0 ? (
          <div className="space-y-3">
            {props.requests.map((request) => (
              <RequestCard key={request.id} request={request} props={props} />
            ))}
          </div>
        ) : (
          <EmptyState option={activeOption} />
        )}
      </section>

      {!props.loading && !props.error && (
        <Pagination
          page={props.page}
          pageSize={ADMIN_PAGE_SIZE}
          count={props.requests.length}
          total={props.total}
          hasPrevious={props.page > 1}
          hasNext={props.page * ADMIN_PAGE_SIZE < props.total}
          onPrevious={() => props.setPage(props.page - 1)}
          onNext={() => props.setPage(props.page + 1)}
          noun="requests"
        />
      )}
    </main>
  );
}

function LoadingState() {
  return (
    <div role="status" aria-label="Loading requests" className="space-y-3">
      {[0, 1].map((item) => (
        <div key={item} className="animate-pulse rounded-2xl border border-border/50 bg-card/50 p-5">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-36 rounded-full bg-muted" />
              <div className="h-2.5 w-52 max-w-full rounded-full bg-muted" />
            </div>
            <div className="h-6 w-20 rounded-full bg-muted" />
          </div>
          <div className="mt-5 space-y-2 border-t border-border/40 pt-4">
            <div className="h-2.5 w-24 rounded-full bg-muted" />
            <div className="h-3 w-3/4 max-w-full rounded-full bg-muted" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading requests…</span>
    </div>
  );
}

function EmptyState({ option }: { option: (typeof STATUS_OPTIONS)[number] }) {
  const Icon = option.Icon;
  const iconTone = option.value === 'pending' ? 'text-warn' : option.value === 'approved' ? 'text-ok' : 'text-danger';

  return (
    <div className="relative flex min-h-[280px] flex-col items-center justify-center overflow-hidden rounded-[1.75rem] border border-dashed border-border/70 bg-card/40 px-6 py-14 text-center">
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 size-52 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/5 blur-3xl" />
      <div className={cn('relative flex size-14 items-center justify-center rounded-2xl border border-border/70 bg-background shadow-brutal-xs', iconTone)}>
        <Icon className="size-6" strokeWidth={1.7} aria-hidden="true" />
      </div>
      <p className="eyebrow relative mt-5 text-muted-foreground">{option.label} queue clear</p>
      <h2 className="relative mt-2 font-heading text-xl font-semibold tracking-tight text-foreground">{option.emptyTitle}</h2>
      <p className="relative mt-2 max-w-md text-sm leading-6 text-muted-foreground">{option.emptyDescription}</p>
    </div>
  );
}

function RequestCard({ request, props }: { request: AdminAccessQueueRequest; props: ViewProps }) {
  const decide = async (decision: 'approved' | 'rejected') => {
    props.setBusy(`${request.id}:${decision}`);
    props.setError('');

    try {
      await AdminApi.decideAdminAccessRequest(request.id, decision, props.notes[request.id]);
      await props.reload();
    } catch {
      props.setError('We couldn’t save that decision. Check your connection and try again.');
    } finally {
      props.setBusy('');
    }
  };

  const requester = request.requester;
  const isPending = request.status === 'pending';
  const requestBusy = props.busy.startsWith(`${request.id}:`);
  const disabled = requestBusy || !requester || requester.disabled;
  const badgeTone = request.status === 'approved' ? 'ok' : request.status === 'rejected' ? 'danger' : 'warn';
  const railTone = request.status === 'approved' ? 'bg-ok' : request.status === 'rejected' ? 'bg-danger' : 'bg-warn';

  return (
    <article className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 p-5 pl-6 shadow-brutal-xs transition-[border-color,box-shadow] duration-200 hover:border-border hover:shadow-brutal-sm sm:p-6 sm:pl-7">
      <div className={cn('absolute inset-y-0 left-0 w-1', railTone)} aria-hidden="true" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background font-mono text-xs font-bold text-muted-foreground">
            {requester ? initials(requester.name) : <UserRound className="size-4" aria-hidden="true" />}
          </div>
          <div className="min-w-0">
            <h2 className="truncate font-semibold text-foreground">{requester?.name || 'Unavailable user'}</h2>
            <p className="truncate text-sm text-muted-foreground">{requester?.email || 'No email available'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 sm:pl-4">
          <div className="text-left sm:text-right">
            <p className="eyebrow text-muted-foreground/70">SUBMITTED</p>
            <p className="mt-1 text-xs text-muted-foreground">{formatDate(request.createdAt)}</p>
          </div>
          <Badge tone={badgeTone} className="shrink-0 uppercase tracking-[0.12em]">{request.status}</Badge>
        </div>
      </div>

      <div className="mt-5 grid gap-4 border-t border-border/40 pt-4 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <p className="eyebrow text-muted-foreground/70">REQUEST NOTE</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/85">
            {request.justification || 'No justification provided.'}
          </p>
        </div>
        {!isPending && request.decidedAt && (
          <div className="sm:text-right">
            <p className="eyebrow text-muted-foreground/70">DECIDED</p>
            <p className="mt-2 text-sm text-muted-foreground">{formatDate(request.decidedAt)}</p>
          </div>
        )}
      </div>

      {!isPending && request.decisionNote && (
        <div className="mt-4 rounded-xl border border-border/50 bg-background/40 px-4 py-3">
          <p className="eyebrow text-muted-foreground/70">DECISION NOTE</p>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{request.decisionNote}</p>
        </div>
      )}

      {isPending && (
        <div className="mt-5 border-t border-border/40 pt-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <div className="flex items-end justify-between gap-3">
                <label htmlFor={`decision-note-${request.id}`} className="eyebrow text-foreground">
                  Decision note <span className="text-muted-foreground">(optional)</span>
                </label>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {(props.notes[request.id] || '').length}/500
                </span>
              </div>
              <Textarea
                id={`decision-note-${request.id}`}
                value={props.notes[request.id] || ''}
                maxLength={500}
                placeholder="Explain the decision or any next step for the requester."
                onChange={(event) => props.setNotes({ ...props.notes, [request.id]: event.target.value })}
                className="mt-2 min-h-24"
              />
              <p className="mt-2 text-xs text-muted-foreground">This note will be visible to the requester.</p>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="danger"
                size="sm"
                disabled={disabled}
                onClick={() => void decide('rejected')}
              >
                <X className="size-3.5" aria-hidden="true" />
                {props.busy === `${request.id}:rejected` ? 'Rejecting...' : 'Reject'}
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={disabled}
                onClick={() => void decide('approved')}
              >
                <Check className="size-3.5" aria-hidden="true" />
                {props.busy === `${request.id}:approved` ? 'Approving...' : 'Approve'}
              </Button>
            </div>
          </div>

          {requester?.disabled && (
            <p className="mt-3 text-xs text-warn">This account is disabled and cannot be promoted.</p>
          )}
          {!requester && (
            <p className="mt-3 text-xs text-muted-foreground">The requesting account is no longer available.</p>
          )}
        </div>
      )}
    </article>
  );
}

function initials(name: string) {
  const value = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('');

  return value.toUpperCase() || '??';
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}
