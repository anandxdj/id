'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { AdminNav } from '@/features/admin/components/AdminNav';
import { Button } from '@/components/ui/button';

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
    return <main className="flex min-h-screen items-center justify-center text-white/50">Loading…</main>;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-white">id admin</h1>
          <p className="text-sm text-white/50">Signed in as {user.email}</p>
        </div>
        <Link href="/account">
          <Button variant="ghost" className="h-9 px-3 text-xs">
            My account
          </Button>
        </Link>
      </header>
      <AdminNav />
      <div className="py-6">{children}</div>
    </div>
  );
}
