'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { LayoutDashboard, Link2, ShieldCheck, User, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { href: '/account', label: 'Overview', icon: LayoutDashboard },
  { href: '/account/apps', label: 'Connected apps', icon: Link2 },
  { href: '/account/security', label: 'Security', icon: ShieldCheck },
  { href: '/account/profile', label: 'Profile', icon: User },
  { href: '/account/danger', label: 'Danger Zone', icon: AlertTriangle, isDanger: true },
];

export function AccountNav() {
  const path = usePathname();

  return (
    <div className="relative border-b border-border">
      <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth">
        {tabs.map((t) => {
          const active = path === t.href;
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                'group relative flex items-center gap-2 px-4 py-3 font-mono text-xs font-bold uppercase tracking-wider transition-colors shrink-0 select-none rounded-t-md hover:bg-accent/30',
                active
                  ? t.isDanger
                    ? 'text-danger'
                    : 'text-foreground'
                  : t.isDanger
                    ? 'text-muted-foreground hover:text-danger'
                    : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon
                className={cn(
                  'size-3.5 transition-colors',
                  active
                    ? t.isDanger
                      ? 'text-danger'
                      : 'text-foreground'
                    : t.isDanger
                      ? 'text-muted-foreground group-hover:text-danger'
                      : 'text-muted-foreground group-hover:text-foreground'
                )}
              />
              <span>{t.label}</span>

              {/* Animated active sliding underline */}
              {active && (
                <motion.div
                  layoutId="activeAccountNavUnderline"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  className={cn(
                    'absolute bottom-0 inset-x-0 h-0.5 z-10',
                    t.isDanger ? 'bg-danger' : 'bg-brand'
                  )}
                />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

