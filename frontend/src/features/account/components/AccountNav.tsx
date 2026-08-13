'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const tabs = [
  { href: '/account', label: 'Overview' },
  { href: '/account/apps', label: 'Connected apps' },
  { href: '/account/security', label: 'Security' },
  { href: '/account/profile', label: 'Profile' },
  { href: '/account/danger', label: 'Danger Zone' },
];

export function AccountNav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto border-b-2 border-border">
      {tabs.map((t) => {
        const active = path === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              'whitespace-nowrap border-b-2 px-4 py-3 font-mono text-xs font-bold uppercase tracking-wide transition-colors',
              active
                ? '-mb-0.5 border-brand text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
