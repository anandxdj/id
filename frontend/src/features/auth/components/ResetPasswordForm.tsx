'use client';

import { useEffect, useState } from 'react';
import { AuthApi } from '@/features/auth/services/authApi';
import { FragmentToken } from '@/lib/fragment-token';
import { AUTH_COPY, ROUTES } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';

export function ResetPasswordForm() {
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const value = FragmentToken.read();
    FragmentToken.clear();
    setToken(value);
    if (!value) setError(AUTH_COPY.MISSING_TOKEN);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < AUTH_COPY.PASSWORD_MIN_LENGTH) {
      setError(`Password must be at least ${AUTH_COPY.PASSWORD_MIN_LENGTH} characters long.`);
      return;
    }
    setSubmitting(true);
    try {
      await AuthApi.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <Card variant="gooey">
        <CardTitle>Password updated</CardTitle>
        <CardDescription>{AUTH_COPY.RESET_OK}</CardDescription>
        <div className="mt-6">
          <a href={ROUTES.LOGIN}>
            <Button className="w-full">Sign in</Button>
          </a>
        </div>
      </Card>
    );
  }

  return (
    <Card variant="gooey">
      <CardTitle>Choose a new password</CardTitle>
      <CardDescription>This link works once. After you save, every other device is signed out.</CardDescription>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={!token}
          />
        </div>
        <div>
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={!token}
          />
        </div>
        {error && (
          <p className="border-2 border-danger bg-danger/10 px-3 py-2 font-mono text-xs font-bold text-danger">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={submitting || !token}>
          {submitting ? 'Saving…' : 'Save password'}
        </Button>
      </form>
      <div className="mt-6 text-center text-sm text-muted-foreground">
        <a href={ROUTES.FORGOT_PASSWORD} className="font-bold underline hover:text-foreground">
          Request a new link
        </a>
      </div>
    </Card>
  );
}
