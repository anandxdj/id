'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { AdminApi } from '@/features/admin/services/adminApi';
import type { AdminAccessQueueRequest, AdminAccessRequestStatus } from '@/types';

type ViewProps = {
  status: AdminAccessRequestStatus;
  setStatus(value: AdminAccessRequestStatus): void;
  requests: AdminAccessQueueRequest[];
  notes: Record<string, string>;
  setNotes(value: Record<string, string>): void;
  busy: string;
  setBusy(value: string): void;
  error: string;
  setError(value: string): void;
  reload(): Promise<void>;
};

export default function AdminRequestsPage() {
  const [status, setStatus] = useState<AdminAccessRequestStatus>('pending');
  const [requests, setRequests] = useState<AdminAccessQueueRequest[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try { setError(''); setRequests(await AdminApi.listAdminAccessRequests(status)); }
    catch (e) { setError((e as Error).message); }
  }, [status]);
  useEffect(() => { void load(); }, [load]);
  return <RequestsView status={status} setStatus={setStatus} requests={requests} notes={notes}
    setNotes={setNotes} busy={busy} setBusy={setBusy} error={error} setError={setError} reload={load} />;
}

function RequestsView(props: ViewProps) {
  return <main><h1>Admin access requests</h1>
    {props.error && <p>{props.error}</p>}
    <StatusTabs status={props.status} setStatus={props.setStatus} />
    <Panel>{props.requests.length ? props.requests.map((request) =>
      <RequestCard key={request.id} request={request} props={props} />) : <p>No {props.status} requests.</p>}</Panel>
  </main>;
}

function StatusTabs({ status, setStatus }: Pick<ViewProps, 'status' | 'setStatus'>) {
  const statuses: AdminAccessRequestStatus[] = ['pending', 'approved', 'rejected'];
  return <nav>{statuses.map((value) => <Button key={value}
    variant={status === value ? 'primary' : 'secondary'} onClick={() => setStatus(value)}>{value}</Button>)}</nav>;
}

function RequestCard({ request, props }: { request: AdminAccessQueueRequest; props: ViewProps }) {
  const decide = async (decision: 'approved' | 'rejected') => {
    props.setBusy(request.id); props.setNotes({ ...props.notes });
    try {
      await AdminApi.decideAdminAccessRequest(request.id, decision, props.notes[request.id]);
      await props.reload();
    } catch (error) {
      props.setError((error as Error).message);
    } finally { props.setBusy(''); }
  };
  return <RequestDetails request={request} props={props} decide={decide} />;
}

function RequestDetails({ request, props, decide }: {
  request: AdminAccessQueueRequest; props: ViewProps; decide(value: 'approved' | 'rejected'): Promise<void>;
}) {
  return <article><Badge tone={request.status === 'approved' ? 'ok' : request.status === 'rejected' ? 'danger' : 'warn'}>{request.status}</Badge>
    <h2>{request.requester?.name || 'Unavailable user'}</h2><p>{request.requester?.email}</p>
    <p>{request.justification || 'No justification provided.'}</p>
    {request.status === 'pending' && <DecisionControls request={request} props={props} decide={decide} />}
  </article>;
}

function DecisionControls({ request, props, decide }: {
  request: AdminAccessQueueRequest; props: ViewProps; decide(value: 'approved' | 'rejected'): Promise<void>;
}) {
  const disabled = props.busy === request.id || !request.requester || request.requester.disabled;
  return <div><textarea value={props.notes[request.id] || ''} maxLength={500} placeholder={'Optional decision note'}
    onChange={(event) => props.setNotes({ ...props.notes, [request.id]: event.target.value })} />
    <Button disabled={disabled} onClick={() => void decide('approved')}>Approve</Button>
    <Button variant={'danger'} disabled={disabled} onClick={() => void decide('rejected')}>Reject</Button>
  </div>;
}
