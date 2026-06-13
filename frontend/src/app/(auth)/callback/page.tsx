'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { resumeOAuth } from '@/lib/oauth-resume';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';

function CallbackInner() {
  const { setSession } = useAuth();
  const router = useRouter();
  const ran = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ran.current) return; // guard React strict-mode double-invoke (token is single-use-ish)
    ran.current = true;

    // The backend bridges the access token + return_to in the URL fragment.
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const token = params.get('token');
    const returnTo = params.get('return_to');

    if (!token) {
      router.replace('/login?error=missing_token');
      return;
    }

    setSession(token)
      .then(() => {
        // Clear the token from the address bar before any further navigation.
        window.history.replaceState(null, '', '/callback');
        if (!resumeOAuth(returnTo)) router.replace('/account');
      })
      .catch(() => setError('Could not establish your session. Please sign in again.'));
  }, [router, setSession]);

  return (
    <Card>
      <CardTitle>{error ? 'Sign-in failed' : 'Signing you in…'}</CardTitle>
      <CardDescription>{error ?? 'Completing authentication.'}</CardDescription>
    </Card>
  );
}

export default function CallbackPage() {
  return (
    <Suspense fallback={null}>
      <CallbackInner />
    </Suspense>
  );
}
