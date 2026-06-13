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
      <Card>
        <CardTitle>Authorization error</CardTitle>
        <CardDescription>{error}</CardDescription>
      </Card>
    );
  }

  if (!ctx) {
    return (
      <Card>
        <CardDescription>Loading request…</CardDescription>
      </Card>
    );
  }

  const scopes = ctx.scope.split(/\s+/).filter(Boolean);

  return (
    <Card>
      <CardTitle>{ctx.client_name}</CardTitle>
      <CardDescription>
        {ctx.description || `${ctx.client_name} wants to access your id account.`}
      </CardDescription>

      <ul className="mt-6 space-y-2">
        {scopes.map((s) => (
          <li key={s} className="flex items-start gap-2 text-sm text-white/80">
            <span className="mt-0.5 text-white/40">•</span>
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
