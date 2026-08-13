'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { resumeOAuth } from '@/lib/oauth-resume';
import { OAuthErrors } from '@/lib/oauth-errors';
import { ROUTES } from '@/lib/constants';
import { getConnectors, connectorStartUrl, type Connector } from '@/features/auth/services/connectorsApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';

export function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('return_to');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [connectors, setConnectors] = useState<Connector[]>([]);

  useEffect(() => {
    setError(OAuthErrors.messageFor(searchParams.get('error')));
    getConnectors().then(setConnectors).catch(() => setConnectors([]));
  }, [searchParams]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      if (!resumeOAuth(returnTo)) router.push(ROUTES.ACCOUNT);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setSubmitting(false);
    }
  }

  const registerHref = returnTo
    ? `${ROUTES.REGISTER}?return_to=${encodeURIComponent(returnTo)}`
    : ROUTES.REGISTER;

  return (
    <Card variant="gooey">
      <CardTitle>Sign in</CardTitle>
      <CardDescription>
        {returnTo ? 'Authorize access to continue to the app.' : 'Welcome back.'}
      </CardDescription>

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
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <a href={ROUTES.FORGOT_PASSWORD} className="font-mono text-[11px] font-bold underline hover:text-foreground">
              Forgot password
            </a>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && (
          <p className="border-2 border-danger bg-danger/10 px-3 py-2 font-mono text-xs font-bold text-danger">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <div className="mt-6 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <a href={registerHref} className="font-bold underline hover:text-foreground">
          Sign up
        </a>
      </div>

      {connectors.length > 0 && (
        <>
          <div className="my-6 flex items-center gap-3">
            <span className="h-0.5 flex-1 bg-border" />
            <span className="eyebrow text-muted-foreground">OR CONTINUE WITH</span>
            <span className="h-0.5 flex-1 bg-border" />
          </div>
          <div className="space-y-2">
            {connectors.map((c) => (
              <a key={c.provider} href={connectorStartUrl(c.provider, returnTo)} className="block">
                <Button type="button" variant="secondary" className="w-full">
                  Continue with {c.displayName}
                </Button>
              </a>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
