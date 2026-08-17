'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowUpRight, Mail, Terminal } from 'lucide-react';
import { MagneticButton } from '@/components/ui/gooey';

function GithubIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function XTwitterIcon({ className = 'size-3.5' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

interface FooterOrganicProps {
  className?: string;
}

export function FooterOrganic({ className = '' }: FooterOrganicProps) {
  const FOOTER_COLUMNS = [
    {
      title: 'Product',
      links: [
        { label: 'Account overview', href: '/account' },
        { label: 'Connected apps', href: '/account/apps' },
        { label: 'Active sessions', href: '/account/security' },
        { label: 'Profile', href: '/account/profile' },
      ],
    },
    {
      title: 'Developers',
      links: [
        { label: 'OIDC features', href: '#features' },
        { label: 'Integration overview', href: '#docs' },
        { label: 'Security model', href: '#security' },
        { label: 'Source code', href: 'https://github.com/anandxdj/id' },
      ],
    },
    {
      title: 'Operations',
      links: [
        { label: 'Admin overview', href: '/admin' },
        { label: 'Users', href: '/admin/users' },
        { label: 'OAuth clients', href: '/admin/apps' },
        { label: 'Register a client', href: '/admin/apps/new' },
      ],
    },
    {
      title: 'Project',
      links: [
        { label: 'GitHub', href: 'https://github.com/anandxdj/id' },
        { label: 'Issues', href: 'https://github.com/anandxdj/id/issues' },
        { label: 'Discussions', href: 'https://github.com/anandxdj/id/discussions' },
        { label: 'README', href: 'https://github.com/anandxdj/id#readme' },
      ],
    },
  ];

  return (
    <footer className={`relative mx-auto max-w-[1440px] px-3 py-3 select-none sm:px-6 sm:py-4 ${className}`}>
      {/* Dark Organic Island Container with Custom foother.svg */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full overflow-hidden rounded-[1.75rem] px-5 pb-6 pt-8 text-white shadow-2xl sm:rounded-[2.8rem] sm:px-10 sm:pb-7 sm:pt-10 md:px-12"
      >
        {/* Custom SVG Background */}
        <img
          src="/landing_components/foother.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 size-full object-fill filter invert dark:filter-none drop-shadow-xl transition-[filter] duration-300 z-0"
        />

        {/* Inner Content Grid */}
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-8 items-start w-full">
          {/* Column 1: Brand & Socials (3 cols) */}
          <div className="lg:col-span-3 space-y-3.5">
            <Link href="/" className="flex items-center gap-2.5 group w-fit">
              <div className="flex items-center gap-1 transition-transform duration-200 group-hover:scale-110">
                <div className="size-5 sm:size-6 rounded-full bg-zinc-950 dark:bg-white flex items-center justify-center shadow-xs">
                  <div className="size-2 rounded-full bg-white dark:bg-black" />
                </div>
                <div className="size-3 sm:size-3.5 rounded-full bg-zinc-950 dark:bg-white" />
              </div>
              <span className="font-heading font-black text-xl sm:text-2xl tracking-tight text-zinc-950 dark:text-white">
                ID
              </span>
            </Link>

            <p className="text-[11px] sm:text-xs text-zinc-600 dark:text-zinc-400 max-w-xs leading-relaxed">
              A self-hosted OpenID Connect provider for universal sign-in across internal applications.
            </p>

            {/* Social Icons with Magnetic Hover */}
            <div className="flex items-center gap-2 pt-1">
              {[
                { href: 'https://github.com/anandxdj/id', icon: GithubIcon, label: 'GitHub' },
                { href: 'https://x.com/anandxdj', icon: XTwitterIcon, label: 'Twitter / X' },
                { href: '#terminal', icon: Terminal, label: 'Terminal' },
                { href: '#email', icon: Mail, label: 'Email' },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <MagneticButton key={item.label} strength={0.3}>
                    <a
                      href={item.href}
                      target={item.href.startsWith('http') ? '_blank' : undefined}
                      rel="noreferrer"
                      aria-label={item.label}
                      className="size-7 sm:size-8 rounded-full bg-black/5 border border-black/10 text-zinc-700 hover:text-black hover:bg-black/10 dark:bg-[#232324] dark:border-white/5 dark:text-zinc-400 dark:hover:text-white dark:hover:border-white/20 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors"
                    >
                      <Icon className="size-3.5" />
                    </a>
                  </MagneticButton>
                );
              })}
            </div>
          </div>

          {/* Column 2: Navigation Links (5 cols) */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-4 sm:gap-6 lg:col-span-5">
            {FOOTER_COLUMNS.map((col) => (
              <div key={col.title} className="space-y-2.5">
                <h5 className="font-heading font-bold text-xs text-zinc-950 dark:text-white">
                  {col.title}
                </h5>
                <ul className="space-y-1.5 text-[11px]">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white transition-colors duration-150 inline-block hover:translate-x-0.5 transform"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Column 3: Integration handoff (4 cols) */}
          <div className="lg:col-span-4 rounded-2xl bg-black/5 border border-black/10 dark:bg-[#191919] dark:border-white/5 p-4 sm:p-5 space-y-2">
            <h5 className="font-heading font-bold text-xs sm:text-sm text-zinc-950 dark:text-white">Connect an application</h5>
            <p className="text-[10.5px] sm:text-[11px] text-zinc-600 dark:text-zinc-400 leading-snug">
              Register an OAuth client, then configure your app from the provider&apos;s discovery metadata.
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <Link
                href="/admin/apps/new"
                className="inline-flex items-center gap-1.5 rounded-full bg-zinc-950 px-3 py-2 text-[10.5px] font-bold text-white transition-transform hover:scale-[1.02] dark:bg-white dark:text-zinc-950"
              >
                Register client <ArrowUpRight className="size-3" />
              </Link>
              <a
                href="https://github.com/anandxdj/id#readme"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-black/10 px-3 py-2 text-[10.5px] font-bold text-zinc-800 transition-colors hover:bg-black/5 dark:border-white/10 dark:text-zinc-200 dark:hover:bg-white/5"
              >
                Read setup guide
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Copyright & Status */}
        <div className="relative z-10 mt-6 flex flex-col items-center justify-between gap-2 border-t border-black/10 pt-3.5 text-center text-[10.5px] text-zinc-600 dark:border-white/10 dark:text-zinc-400 sm:flex-row sm:text-left sm:text-[11px]">
          <p>© 2026 ID. Open source identity infrastructure.</p>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 sm:gap-4">
            <a href="https://github.com/anandxdj/id" target="_blank" rel="noreferrer" className="hover:text-zinc-950 dark:hover:text-white transition-colors">
              github.com/anandxdj/id
            </a>
            <span className="text-zinc-400 dark:text-zinc-600">•</span>
            <a href="https://x.com/anandxdj" target="_blank" rel="noreferrer" className="hover:text-zinc-950 dark:hover:text-white transition-colors">
              @anandxdj
            </a>
          </div>
        </div>
      </motion.div>
    </footer>
  );
}
