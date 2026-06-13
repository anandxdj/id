'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';

export default function AccountPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) {
    return <main className="flex min-h-screen items-center justify-center text-white/50">Loading…</main>;
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card>
        <CardTitle>Signed in</CardTitle>
        <CardDescription>You are authenticated with id.</CardDescription>
        <div className="mt-6 space-y-1 text-sm">
          <p className="text-white">{user.name}</p>
          <p className="text-white/60">{user.email}</p>
          <p className="text-white/40">Role: {user.role}</p>
        </div>
        <Button variant="secondary" className="mt-6 w-full" onClick={() => logout().then(() => router.push('/login'))}>
          Sign out
        </Button>
      </Card>
    </main>
  );
}
