'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { resumeOAuth } from '@/lib/oauth-resume';
import { getConnectors, connectorStartUrl, type Connector } from '@/features/auth/services/connectorsApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';

export function RegisterForm() {
  const { register, login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('return_to');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [connectors, setConnectors] = useState<Connector[]>([]);

  useEffect(() => {
    getConnectors().then(setConnectors).catch(() => setConnectors([]));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create the account
      await register(name, email, password);
      // 2. Automatically log in the user
      await login(email, password);
      // 3. Resume OIDC flow or go to user account dashboard
      if (!resumeOAuth(returnTo)) {
        router.push('/account');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
      setSubmitting(false);
    }
  }

  return (
    <Card variant="gooey">
      <CardTitle>Create an account</CardTitle>
      <CardDescription>
        {returnTo ? 'Sign up to continue to the application.' : 'Sign up to get started.'}
      </CardDescription>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="name">Full Name</Label>
          <Input
            id="name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
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
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>

        {error && (
          <p className="border-2 border-danger bg-danger/10 px-3 py-2 font-mono text-xs font-bold text-danger">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Sign up'}
        </Button>
      </form>

      <div className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <a href={returnTo ? `/login?return_to=${encodeURIComponent(returnTo)}` : '/login'} className="font-bold underline hover:text-foreground">
          Sign in
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
