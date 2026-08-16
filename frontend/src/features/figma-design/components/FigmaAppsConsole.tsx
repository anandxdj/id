'use client';

import React from 'react';
import Link from 'next/link';
import {
  LayoutGrid,
  Folder,
  CreditCard,
  Code,
  BookOpen,
  Users,
  Settings,
  List,
  ArrowUpRight,
} from 'lucide-react';

export const FIGMA_CONSOLE_ITEMS = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    desc: 'Overview of user activity and system health.',
    icon: LayoutGrid,
    href: '/admin',
  },
  {
    id: 'projects',
    title: 'Projects',
    desc: 'Organize and manage your applications.',
    icon: Folder,
    href: '/admin',
  },
  {
    id: 'billing',
    title: 'Billing',
    desc: 'Manage subscriptions and usage.',
    icon: CreditCard,
    href: '/account',
  },
  {
    id: 'api',
    title: 'API Console',
    desc: 'Test, debug, and explore your OIDC APIs.',
    icon: Code,
    href: '#api',
  },
  {
    id: 'docs',
    title: 'Docs',
    desc: 'Guides, tutorials, and best practices.',
    icon: BookOpen,
    href: '#docs',
  },
  {
    id: 'users',
    title: 'Users',
    desc: 'Manage users, roles, and permissions.',
    icon: Users,
    href: '/admin/users',
  },
  {
    id: 'settings',
    title: 'Settings',
    desc: 'Configure system, flows, and integrations.',
    icon: Settings,
    href: '/account/security',
  },
  {
    id: 'logs',
    title: 'Log',
    desc: 'Monitor auth events and audit logs.',
    icon: List,
    href: '/admin',
  },
];

/**
 * Apps console — Figma node 1:4543.
 * Island bbox (15.2, 622.8, 909.3 x 292.8) → core_benifit.svg (910 x 293).
 * Cards are borderless: content sits directly on the cream island.
 */
interface FigmaAppsConsoleProps {
  className?: string;
  primaryHref?: string;
  onOpenTool?: (tool: 'apps' | 'api' | 'auth-flow') => void;
}

export function FigmaAppsConsole({
  className = '',
  primaryHref = '/login',
  onOpenTool,
}: FigmaAppsConsoleProps) {
  return (
    <section
      className={`relative w-full px-4 py-6 sm:px-6 lg:aspect-[941/292.8] lg:px-0 lg:py-0 ${className}`}
    >
      <div className="@container relative w-full lg:absolute lg:inset-y-0 lg:left-[1.615%] lg:w-[96.63%]">
        <img
          src="/landing_components/core_benifit.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 size-full object-fill filter invert dark:filter-none drop-shadow-sm transition-[filter] duration-300"
        />

        <div className="relative z-10 grid h-full grid-cols-1 items-center gap-6 px-6 py-10 lg:grid-cols-12 lg:gap-[2cqw] lg:px-[4.7cqw] lg:py-0">
          {/* Left column: heading & value prop */}
          <div className="space-y-3 lg:col-span-4 lg:space-y-[1.4cqw]">
            <div className="inline-flex w-fit select-none items-center gap-2 rounded-full border border-white/15 bg-white/10 dark:border-black/10 dark:bg-black/5 px-3 py-0.5 lg:gap-[0.6cqw] lg:px-[1.1cqw] lg:py-[0.2cqw]">
              <span className="size-1.5 rounded-full bg-zinc-100 dark:bg-zinc-900 lg:size-[0.5cqw]" />
              <span className="text-[10.5px] font-semibold text-zinc-100 dark:text-zinc-900 lg:text-[1.15cqw]">
                All-in-one Identity Platform
              </span>
            </div>

            <h2 className="font-heading text-2xl font-black leading-[1.04] tracking-tight text-zinc-50 dark:text-zinc-950 lg:text-[3.1cqw]">
              One account.
              <br />
              Access all
              <br />
              your applications.
            </h2>

            <p className="max-w-sm text-xs font-normal leading-relaxed text-zinc-300 dark:text-zinc-600 lg:max-w-none lg:text-[1.25cqw]">
              Everything you need to manage identities, applications, and access from a single powerful dashboard.
            </p>

            {onOpenTool ? (
              <button
                type="button"
                onClick={() => onOpenTool('apps')}
                className="inline-flex cursor-pointer items-center gap-2.5 rounded-full bg-white text-zinc-950 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-white dark:hover:bg-zinc-800 px-5 py-2.5 text-xs font-semibold shadow-md transition-all duration-150 hover:scale-105 active:scale-95 lg:gap-[0.9cqw] lg:px-[1.9cqw] lg:py-[0.9cqw] lg:text-[1.25cqw]"
              >
                <span>Explore Platform</span>
                <span className="flex size-4 items-center justify-center rounded-full bg-black/10 text-black dark:bg-white/20 dark:text-white lg:size-[1.5cqw]">
                  <ArrowUpRight className="size-3 lg:size-[1.1cqw]" />
                </span>
              </button>
            ) : (
              <Link href={primaryHref} className="inline-flex cursor-pointer items-center gap-2.5 rounded-full bg-white text-zinc-950 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-white dark:hover:bg-zinc-800 px-5 py-2.5 text-xs font-semibold shadow-md transition-all duration-150 hover:scale-105 active:scale-95 lg:gap-[0.9cqw] lg:px-[1.9cqw] lg:py-[0.9cqw] lg:text-[1.25cqw]">
                <span>Explore Platform</span>
                <span className="flex size-4 items-center justify-center rounded-full bg-black/10 text-black dark:bg-white/20 dark:text-white lg:size-[1.5cqw]">
                  <ArrowUpRight className="size-3 lg:size-[1.1cqw]" />
                </span>
              </Link>
            )}
          </div>

          {/* Right column: 2x4 borderless card grid */}
          <div className="lg:col-span-8">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 lg:gap-x-[2.2cqw] lg:gap-y-[3.8cqw]">
              {FIGMA_CONSOLE_ITEMS.map((item) => {
                const Icon = item.icon;
                const tool = item.id === 'dashboard' ? 'apps' : item.id === 'api' ? 'api' : item.id === 'logs' ? 'auth-flow' : null;
                const content = (
                  <>
                    <div>
                      <Icon className="mb-1.5 size-4 stroke-[1.75] text-zinc-100 dark:text-zinc-950 lg:mb-[0.6cqw] lg:size-[1.7cqw]" />
                      <h4 className="font-heading text-xs font-bold text-zinc-50 dark:text-zinc-950 lg:text-[1.35cqw]">
                        {item.title}
                      </h4>
                      <p className="mt-0.5 text-[10.5px] font-normal leading-snug text-zinc-400 dark:text-zinc-500 lg:mt-[0.3cqw] lg:text-[1.1cqw]">
                        {item.desc}
                      </p>
                    </div>

                    <div className="mt-2 flex justify-end lg:mt-[0.8cqw]">
                      <div className="flex size-5 items-center justify-center rounded-full bg-white text-zinc-950 dark:bg-zinc-950 dark:text-white shadow-xs transition-transform group-hover:scale-110 lg:size-[2.15cqw]">
                        <ArrowUpRight className="size-2.5 lg:size-[1.2cqw]" />
                      </div>
                    </div>
                  </>
                );

                return tool && onOpenTool ? (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onOpenTool(tool)}
                    className="group flex cursor-pointer flex-col justify-between text-left transition-transform duration-200 hover:scale-[1.03]"
                  >
                    {content}
                  </button>
                ) : (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="group flex cursor-pointer flex-col justify-between transition-transform duration-200 hover:scale-[1.03]"
                  >
                    {content}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
