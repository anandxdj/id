'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { AccountNav } from '@/features/account/components/AccountNav';
import { Button } from '@/components/ui/button';

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) {
    return <main className="flex min-h-screen items-center justify-center text-white/50">Loading…</main>;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-white">id account</h1>
          <p className="text-sm text-white/50">{user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          {user.role !== 'user' && (
            <Link href="/admin">
              <Button variant="secondary" className="h-9 px-3 text-xs">
                Admin
              </Button>
            </Link>
          )}
          <Button variant="ghost" className="h-9 px-3 text-xs" onClick={() => logout().then(() => router.push('/login'))}>
            Sign out
          </Button>
        </div>
      </header>
      <AccountNav />
      <div className="py-6">{children}</div>
    </div>
  );
}
