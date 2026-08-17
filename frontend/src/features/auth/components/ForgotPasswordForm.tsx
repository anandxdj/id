'use client';

import { useState } from 'react';
import { AuthApi } from '@/features/auth/services/authApi';
import { AUTH_COPY, ROUTES } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await AuthApi.forgotPassword(email);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <Card variant="gooey">
        <CardTitle>Check your email</CardTitle>
        <CardDescription>{AUTH_COPY.FORGOT_SENT}</CardDescription>
        <div className="mt-6 text-center text-sm">
          <a href={ROUTES.LOGIN} className="font-bold underline hover:text-foreground">
            Back to sign in
          </a>
        </div>
      </Card>
    );
  }

  return (
    <Card variant="gooey">
      <CardTitle>Reset password</CardTitle>
      <CardDescription>Enter the address on the account. If it exists, a one-time link will be sent.</CardDescription>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        {error && (
          <p role="alert" className="rounded-lg border border-danger/60 bg-danger/10 px-3 py-2 font-mono text-xs font-bold text-danger">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
      <div className="mt-6 text-center text-sm text-muted-foreground">
        <a href={ROUTES.LOGIN} className="font-bold underline hover:text-foreground">
          Back to sign in
        </a>
      </div>
    </Card>
  );
}
