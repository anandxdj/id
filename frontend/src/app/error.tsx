'use client';

import { useEffect } from 'react';
import { ROUTES } from '@/lib/constants';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6">
      <p className="eyebrow text-muted-foreground">[ ERROR ]</p>
      <h1 className="font-heading text-3xl font-black tracking-tight">Something broke</h1>
      <p className="max-w-md text-center text-sm text-muted-foreground">
        The page hit an unexpected error. You can retry, or go back to sign in.
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="border-2 border-border bg-card px-4 py-2 font-mono text-xs font-bold shadow-brutal-xs"
        >
          Retry
        </button>
        <a
          href={ROUTES.LOGIN}
          className="border-2 border-border bg-brand px-4 py-2 font-mono text-xs font-bold text-brand-foreground shadow-brutal-xs"
        >
          Sign in
        </a>
      </div>
    </main>
  );
}
