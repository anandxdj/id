'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AuthApi } from '@/features/auth/services/authApi';
import { FragmentToken } from '@/lib/fragment-token';
import { AUTH_COPY, ROUTES } from '@/lib/constants';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';

type Status = 'pending' | 'ok' | 'error';

export function VerifyEmailForm() {
  const [status, setStatus] = useState<Status>('pending');
  const [message, setMessage] = useState('Confirming your email…');

  useEffect(() => {
    const token = FragmentToken.read();
    FragmentToken.clear();
    if (!token) {
      setStatus('error');
      setMessage(AUTH_COPY.MISSING_TOKEN);
      return;
    }
    AuthApi.verifyEmail(token)
      .then(() => {
        setStatus('ok');
        setMessage(AUTH_COPY.VERIFY_OK);
      })
      .catch((err: unknown) => {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : AUTH_COPY.MISSING_TOKEN);
      });
  }, []);

  return (
    <Card variant="gooey">
      <CardTitle>{status === 'ok' ? 'Email confirmed' : status === 'error' ? 'Link expired' : 'Verifying…'}</CardTitle>
      <CardDescription>{message}</CardDescription>
      {status !== 'pending' && (
        <div className="mt-6 text-center">
          <Link
            href={ROUTES.LOGIN}
            className="flex h-10.5 w-full items-center justify-center rounded-xl border border-transparent bg-brand px-5 text-sm font-medium text-brand-foreground shadow-sm transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {status === 'ok' ? 'Sign in' : 'Back to sign in'}
          </Link>
        </div>
      )}
    </Card>
  );
}
