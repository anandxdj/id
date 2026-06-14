'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const tabs = [
  { href: '/admin', label: 'Dashboard', exact: true },
  { href: '/admin/users', label: 'Users', exact: false },
  { href: '/admin/apps', label: 'Apps', exact: false },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-white/10">
      {tabs.map((t) => {
        const active = t.exact ? path === t.href : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              'whitespace-nowrap px-4 py-3 text-sm transition-colors',
              active ? 'border-b-2 border-white text-white' : 'text-white/50 hover:text-white/80',
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
