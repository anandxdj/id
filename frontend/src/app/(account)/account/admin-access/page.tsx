'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { SectionHeading } from '@/components/ui/section-heading';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { AccountApi } from '@/features/account/services/accountApi';
import type { AdminAccessRequest } from '@/types';

type AccessProps = {
  userRole?: string;
  pending?: AdminAccessRequest;
  requests: AdminAccessRequest[];
  value: string;
  onChange(value: string): void;
  onSubmit(): void;
  busy: boolean;
  error: string;
};

export default function AdminAccessPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<AdminAccessRequest[]>([]);
  const [justification, setJustification] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setRequests(await AccountApi.listAdminAccessRequests()); }
    catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const submit = async () => {
    setBusy(true); setError('');
    try {
      await AccountApi.createAdminAccessRequest(justification.trim() || undefined);
      setJustification(''); await load();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const pending = requests.find((request) => request.status === 'pending');
  return <AccessRequestContent userRole={user?.role} pending={pending} requests={requests}
    value={justification} onChange={setJustification} onSubmit={submit} busy={busy} error={error} />;
}

function RequestState(props: AccessProps) {
  if (props.userRole !== 'user') return <p>Already an administrator.</p>;
  if (props.pending) return <PendingRequest request={props.pending} />;
  return <RequestForm {...props} />;
}

function PendingRequest({ request }: { request: AdminAccessRequest }) {
  return <Panel><Badge tone={'warn'}>Pending</Badge><p>{request.justification || 'No justification provided.'}</p></Panel>;
}

function RequestForm(props: AccessProps) {
  return <Panel><textarea value={props.value} onChange={(event) => props.onChange(event.target.value)}
    maxLength={500} rows={4} placeholder={'Optional justification'} />
    <Button onClick={props.onSubmit} disabled={props.busy}>{props.busy ? 'Submitting…' : 'Request admin access'}</Button>
  </Panel>;
}

function RequestHistory({ requests }: { requests: AdminAccessRequest[] }) {
  if (!requests.length) return <Panel>No requests yet.</Panel>;
  return <Panel>{requests.map((request) => <div key={request.id}>
    <Badge tone={request.status === 'approved' ? 'ok' : request.status === 'rejected' ? 'danger' : 'warn'}>{request.status}</Badge>
    <p>{request.justification}</p><p>{request.decisionNote}</p>
  </div>)}</Panel>;
}

function AccessRequestContent(props: AccessProps) {
  return <section className={'space-y-8'}>
    <SectionHeading eyebrow={'ADMIN ACCESS'} title={'Request administrator access'} />
    {props.error && <p role={'alert'} className={'text-danger'}>{props.error}</p>}
    <RequestState {...props} />
    <RequestHistory requests={props.requests} />
  </section>;
}
