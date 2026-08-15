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
    href: '/admin/clients',
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
    href: '/admin/audit',
  },
];

export function FigmaAppsConsole() {
  return (
    <section className="relative mx-auto max-w-[1600px] px-2 sm:px-6 py-2">
      {/* 2nd Section Organic Island Container */}
      <div className="relative w-full aspect-[910/293] min-h-[310px] md:min-h-[350px] flex items-center justify-center p-4 sm:p-6 md:p-8 lg:px-12 lg:py-4 select-none">
        {/* Background SVG: core_benifit.svg */}
        <img
          src="/landing_components/core_benifit.svg"
          alt=""
          className="absolute inset-0 w-full h-full object-fill pointer-events-none z-0 origin-center"
          aria-hidden="true"
        />

        {/* Inner Content Grid */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-center w-full px-3 sm:px-6">
          {/* Left Column: Heading & Value Prop (4 cols) */}
          <div className="lg:col-span-4 space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-black/5 border border-black/10 select-none w-fit">
              <span className="size-1.5 rounded-full bg-zinc-900" />
              <span className="text-[10.5px] sm:text-xs font-semibold text-zinc-900">
                All-in-one Identity Platform
              </span>
            </div>

            <h2 className="font-heading text-xl sm:text-2xl md:text-[2.2rem] lg:text-[2.5rem] font-black tracking-tight text-zinc-950 leading-[1.04]">
              One account.
              <br />
              Access all
              <br />
              your applications.
            </h2>

            <p className="text-xs sm:text-[13px] text-zinc-600 font-normal leading-relaxed max-w-sm">
              Everything you need to manage identities, applications, and access from a single powerful dashboard.
            </p>

            <div className="pt-1">
              <Link href="/login">
                <button
                  type="button"
                  className="cursor-pointer inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-zinc-950 text-white font-semibold text-xs sm:text-sm shadow-md hover:bg-zinc-800 hover:scale-105 active:scale-95 transition-all duration-150"
                >
                  <span>Explore Platform</span>
                  <span className="size-4 rounded-full bg-white/20 flex items-center justify-center">
                    <ArrowUpRight className="size-3 text-white" />
                  </span>
                </button>
              </Link>
            </div>
          </div>

          {/* Right Column: 2x4 Grid of App Console Cards (8 cols) */}
          <div className="lg:col-span-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
              {FIGMA_CONSOLE_ITEMS.map((item) => {
                const Icon = item.icon;

                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className="p-3.5 sm:p-4 rounded-2xl bg-white/90 backdrop-blur-xs border border-zinc-200/90 flex flex-col justify-between cursor-pointer hover:bg-white hover:shadow-lg hover:border-zinc-300 hover:scale-[1.02] transition-all duration-200 group min-h-[114px] sm:min-h-[122px]"
                  >
                    <div>
                      <Icon className="size-4 sm:size-4.5 text-zinc-950 mb-1.5 stroke-[1.75]" />
                      <h4 className="font-heading font-bold text-xs sm:text-[13px] text-zinc-950">
                        {item.title}
                      </h4>
                      <p className="mt-0.5 text-[10.5px] sm:text-[11px] text-zinc-500 font-normal leading-snug">
                        {item.desc}
                      </p>
                    </div>

                    <div className="mt-2 flex justify-end">
                      <div className="size-5 sm:size-5.5 rounded-full bg-zinc-950 text-white flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs">
                        <ArrowUpRight className="size-2.5" />
                      </div>
                    </div>
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
