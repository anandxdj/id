'use client';

import Link from 'next/link';
import { useAuth } from '@/features/auth/hooks/useAuth';

const cards = [
  { href: '/account/apps', title: 'Connected apps', desc: 'Review and revoke apps you’ve granted access to.' },
  { href: '/account/security', title: 'Security', desc: 'See active sessions and sign out of other devices.' },
  { href: '/account/profile', title: 'Profile', desc: 'Update your name and details.' },
];

export default function AccountOverviewPage() {
  const { user } = useAuth();
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">Welcome, {user?.name}</h2>
        <p className="mt-1 text-sm text-white/50">Manage your id account and what it can access.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-white/25"
          >
            <p className="font-medium text-white">{c.title}</p>
            <p className="mt-1 text-xs text-white/50">{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
