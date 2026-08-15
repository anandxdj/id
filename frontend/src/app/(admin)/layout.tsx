'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { AdminNav } from '@/features/admin/components/AdminNav';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Logo } from '@/components/ui/logo';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Server still enforces authorize('admin') on every route — this gate is convenience.
  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
    else if (user.role === 'user') router.replace('/account');
  }, [loading, user, router]);

  if (loading || !user || user.role === 'user') {
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
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="select-none flex items-center">
              <Logo size={48} />
            </Link>
            <div>
              <p className="eyebrow text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/account">
              <Button variant="secondary" size="sm">
                My account
              </Button>
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4">
        <AdminNav />
        <div className="py-8">{children}</div>
      </div>
    </div>
  );
}
