'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getConsentContext, decideConsent } from '@/features/consent/services/consentApi';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import type { ConsentContext } from '@/types';

const SCOPE_LABELS: Record<string, string> = {
  openid: 'Confirm your identity',
  profile: 'View your name',
  email: 'View your email address',
};

export function ConsentCard() {
  const searchParams = useSearchParams();
  const transactionId = searchParams.get('transaction_id');

  const [ctx, setCtx] = useState<ConsentContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!transactionId) {
      setError('Missing transaction. Start again from the application.');
      return;
    }
    getConsentContext(transactionId)
      .then(setCtx)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load this request'));
  }, [transactionId]);

  async function decide(decision: 'allow' | 'deny') {
    if (!transactionId) return;
    setBusy(true);
    setError(null);
    try {
      const { redirect_url } = await decideConsent(transactionId, decision);
      window.location.href = redirect_url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setBusy(false);
    }
  }

  if (error) {
    return (
      <Card variant="gooey">
        <CardTitle>Authorization error</CardTitle>
        <CardDescription>{error}</CardDescription>
      </Card>
    );
  }

  if (!ctx) {
    return (
      <Card variant="gooey">
        <CardDescription>Loading request…</CardDescription>
      </Card>
    );
  }

  const scopes = ctx.scope.split(/\s+/).filter(Boolean);

  if (ctx.client_suspended) {
    return (
      <Card variant="gooey">
        <CardTitle>{ctx.client_name}</CardTitle>
        <CardDescription>
          This application is suspended and cannot receive new authorizations. Contact the operator.
        </CardDescription>
      </Card>
    );
  }

  return (
    <Card variant="gooey">
      <div className="flex items-center gap-3">
        {ctx.logo_url ? (
          <img src={ctx.logo_url} alt="" className="size-10 border-2 border-border object-contain bg-background" />
        ) : null}
        <div>
          <CardTitle>{ctx.client_name}</CardTitle>
          <CardDescription>
            {ctx.description || `${ctx.client_name} wants to access your id account.`}
          </CardDescription>
        </div>
      </div>

      <p className="eyebrow mt-6 mb-2 text-muted-foreground">[ REQUESTED_ACCESS ]</p>
      <ul className="space-y-2">
        {scopes.map((s) => (
          <li
            key={s}
            className="flex items-center gap-2 border border-border/45 px-3 py-2 text-sm text-foreground rounded-xl bg-secondary/30"
          >
            <span className="font-mono text-xs font-bold text-brand">›</span>
            {SCOPE_LABELS[s] ?? s}
          </li>
        ))}
      </ul>

      <div className="mt-8 flex gap-3">
        <Button variant="secondary" className="flex-1" disabled={busy} onClick={() => decide('deny')}>
          Deny
        </Button>
        <Button className="flex-1" disabled={busy} onClick={() => decide('allow')}>
          {busy ? 'Authorizing…' : 'Allow'}
        </Button>
      </div>
    </Card>
  );
}
