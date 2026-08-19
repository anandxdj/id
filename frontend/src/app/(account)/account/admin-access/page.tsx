'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, History, ShieldCheck, ShieldPlus, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SectionHeading } from '@/components/ui/section-heading';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { AccountApi } from '@/features/account/services/accountApi';
import { cn } from '@/lib/utils';
import type { AdminAccessRequest } from '@/types';

const MAX_NOTE_LENGTH = 500;

export default function AdminAccessPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<AdminAccessRequest[]>([]);
  const [justification, setJustification] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    await Promise.resolve();
    setLoading(true);
    setError('');
    try {
      setRequests(await AccountApi.listAdminAccessRequests());
    } catch {
      setError('Your access requests could not be loaded. Try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await AccountApi.createAdminAccessRequest(justification.trim() || undefined);
      setJustification('');
      await load();
    } catch {
      setError('Your request could not be submitted. Check the message and try again.');
    } finally {
      setBusy(false);
    }
  };

  const pending = requests.find((request) => request.status === 'pending');
  const history = requests.filter((request) => request.status !== 'pending');

  return (
    <section className="space-y-7">
      <SectionHeading
        eyebrow="ADMIN ACCESS"
        title="Request administrator access"
        description="Ask for elevated permissions and follow the review decision here."
      />

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/5 p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground">Access request unavailable</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : user?.role !== 'user' ? (
        <ElevatedState />
      ) : pending ? (
        <PendingRequest request={pending} />
      ) : (
        <RequestForm
          value={justification}
          onChange={setJustification}
          onSubmit={submit}
          busy={busy}
        />
      )}

      {!loading && history.length > 0 && <RequestHistory requests={history} />}
    </section>
  );
}

function LoadingState() {
  return (
    <div role="status" className="animate-pulse rounded-2xl border border-border/60 bg-card/60 p-6">
      <div className="h-5 w-28 rounded-full bg-muted" />
      <div className="mt-5 h-4 w-3/4 rounded-full bg-muted" />
      <div className="mt-2 h-3 w-1/2 rounded-full bg-muted" />
      <span className="sr-only">Loading administrator access requests</span>
    </div>
  );
}

function ElevatedState() {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-ok/25 bg-ok/5 p-5 sm:p-6">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-ok/25 bg-background text-ok">
        <ShieldCheck className="size-5" aria-hidden="true" />
      </div>
      <div>
        <Badge tone="ok">Access active</Badge>
        <h2 className="mt-3 font-heading text-lg font-semibold text-foreground">You already have administrator access</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Open the admin workspace from the header to manage users, apps, and activity.
        </p>
      </div>
    </div>
  );
}

function PendingRequest({ request }: { request: AdminAccessRequest }) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-warn/30 bg-card/70 shadow-brutal-sm">
      <div className="absolute inset-y-0 left-0 w-1 bg-warn" aria-hidden="true" />
      <div className="p-5 pl-6 sm:p-6 sm:pl-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-warn/25 bg-warn/10 text-warn">
              <Clock3 className="size-5" aria-hidden="true" />
            </div>
            <div>
              <Badge tone="warn">Pending review</Badge>
              <h2 className="mt-3 font-heading text-lg font-semibold text-foreground">Your request is in the review queue</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                A superadministrator will review it. You do not need to submit another request.
              </p>
            </div>
          </div>
          <p className="shrink-0 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            Submitted {formatDate(request.createdAt)}
          </p>
        </div>
        <div className="mt-5 border-t border-border/50 pt-4">
          <p className="eyebrow text-muted-foreground">Your message</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/85">
            {request.justification || 'No message was included.'}
          </p>
        </div>
      </div>
    </article>
  );
}

function RequestForm({
  value,
  onChange,
  onSubmit,
  busy,
}: {
  value: string;
  onChange(value: string): void;
  onSubmit(event: FormEvent): void;
  busy: boolean;
}) {
  const helperId = 'admin-access-message-help';

  return (
    <form onSubmit={onSubmit} className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/70 shadow-brutal-sm">
      <div className="absolute inset-y-0 left-0 w-1 bg-brand" aria-hidden="true" />
      <div className="p-5 pl-6 sm:p-6 sm:pl-7">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-brand/20 bg-brand/10 text-brand">
            <ShieldPlus className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-heading text-lg font-semibold text-foreground">Explain what you need to manage</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              The message is optional, but specific context helps the reviewer make a safe decision.
            </p>
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-end justify-between gap-3">
            <label htmlFor="admin-access-message" className="eyebrow text-foreground">
              Message <span className="text-muted-foreground">(optional)</span>
            </label>
            <span className="font-mono text-[11px] text-muted-foreground">{value.length}/{MAX_NOTE_LENGTH}</span>
          </div>
          <Textarea
            id="admin-access-message"
            aria-describedby={helperId}
            value={value}
            maxLength={MAX_NOTE_LENGTH}
            placeholder="For example: I maintain production sign-in integrations and need to manage registered apps."
            onChange={(event) => onChange(event.target.value)}
            className="mt-2"
          />
          <p id={helperId} className="mt-2 text-xs leading-5 text-muted-foreground">
            Do not include passwords, secrets, or recovery codes.
          </p>
        </div>

        <div className="mt-5 flex justify-end">
          <Button type="submit" disabled={busy}>
            {busy ? 'Requesting access...' : 'Request admin access'}
          </Button>
        </div>
      </div>
    </form>
  );
}

function RequestHistory({ requests }: { requests: AdminAccessRequest[] }) {
  return (
    <section aria-labelledby="access-history-heading" className="space-y-3">
      <div className="flex items-center gap-2">
        <History className="size-4 text-muted-foreground" aria-hidden="true" />
        <h2 id="access-history-heading" className="eyebrow text-muted-foreground">Decision history</h2>
      </div>
      <div className="space-y-3">
        {requests.map((request) => (
          <HistoryItem key={request.id} request={request} />
        ))}
      </div>
    </section>
  );
}

function HistoryItem({ request }: { request: AdminAccessRequest }) {
  const approved = request.status === 'approved';
  const Icon = approved ? CheckCircle2 : XCircle;

  return (
    <article
      className={cn(
        'relative overflow-hidden rounded-xl border bg-card/60 p-5 pl-6',
        approved ? 'border-ok/20' : 'border-danger/20',
      )}
    >
      <div className={cn('absolute inset-y-0 left-0 w-1', approved ? 'bg-ok' : 'bg-danger')} aria-hidden="true" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-2">
          <Icon className={cn('size-4', approved ? 'text-ok' : 'text-danger')} aria-hidden="true" />
          <Badge tone={approved ? 'ok' : 'danger'} className="capitalize">{request.status}</Badge>
        </div>
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          Decided {formatDate(request.decidedAt || request.updatedAt)}
        </p>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="eyebrow text-muted-foreground">Your message</p>
          <p className="mt-1.5 whitespace-pre-wrap text-sm leading-5 text-foreground/85">
            {request.justification || 'No message was included.'}
          </p>
        </div>
        <div>
          <p className="eyebrow text-muted-foreground">Reviewer note</p>
          <p className="mt-1.5 whitespace-pre-wrap text-sm leading-5 text-foreground/85">
            {request.decisionNote || 'No reviewer note was included.'}
          </p>
        </div>
      </div>
    </article>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'date unavailable';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}
