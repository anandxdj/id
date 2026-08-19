'use client';

import Link from 'next/link';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { SectionHeading } from '@/components/ui/section-heading';

const cards = [
  { href: '/account/apps', n: '01', title: 'Connected apps', desc: 'Review and revoke apps you’ve granted access to.' },
  { href: '/account/security', n: '02', title: 'Security', desc: 'See active sessions and sign out of other devices.' },
  { href: '/account/profile', n: '03', title: 'Profile', desc: 'Update your name and details.' },
  { href: '/account/danger', n: '04', title: 'Danger Zone', desc: 'Manage your data and close your account.' },
];

export default function AccountOverviewPage() {
  const { user } = useAuth();
  const visibleCards = user?.role === 'user'
    ? [...cards, { href: '/account/admin-access', n: '05', title: 'Admin access', desc: 'Request administrator access and track the decision.' }]
    : cards;
  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="[ 00_OVERVIEW ]"
        title={`Welcome, ${user?.name ?? 'there'}`}
        description="Manage your id account and what it can access."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {visibleCards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="group border-2 border-border bg-card p-4 shadow-brutal-sm transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal"
          >
            <p className="eyebrow text-muted-foreground">{c.n}</p>
            <p className="mt-3 font-heading font-bold text-foreground">{c.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{c.desc}</p>
            <span className="mt-3 inline-block font-mono text-xs font-bold text-brand opacity-0 transition-opacity group-hover:opacity-100">
              OPEN →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
