'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { AccountNav } from '@/features/account/components/AccountNav';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="eyebrow text-muted-foreground">LOADING…</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* top bar */}
      <header className="sticky top-0 z-20 border-b-2 border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <Link href="/account" className="font-heading text-xl font-bold tracking-tight">
              id<span className="text-muted-foreground">/account</span>
            </Link>
            <p className="eyebrow mt-0.5 text-muted-foreground">{user.email}</p>
          </div>
          <div className="flex items-center gap-2">
            {user.role !== 'user' && (
              <Link href="/admin">
                <Button variant="secondary" size="sm">
                  Admin
                </Button>
              </Link>
            )}
            <Button variant="ghost" size="sm" onClick={() => logout().then(() => router.push('/login'))}>
              Sign out
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4">
        <AccountNav />
        <div className="py-8">{children}</div>
      </div>
    </div>
  );
}
