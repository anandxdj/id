'use client';

import { useEffect, useState } from 'react';
import { AuthApi } from '@/features/auth/services/authApi';
import { FragmentToken } from '@/lib/fragment-token';
import { AUTH_COPY, ROUTES } from '@/lib/constants';
import { Button } from '@/components/ui/button';
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
          <a href={ROUTES.LOGIN}>
            <Button className="w-full">{status === 'ok' ? 'Sign in' : 'Back to sign in'}</Button>
          </a>
        </div>
      )}
    </Card>
  );
}
