'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, MessageSquare, Mail, Terminal } from 'lucide-react';
import { Logo } from '@/components/ui/logo';

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

const FOOTER_COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'Security', href: '#security' },
      { label: 'Pricing', href: '#pricing' },
      { label: 'Changelog', href: '#blog' },
      { label: 'Roadmap', href: '#pricing' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Documentation', href: '#docs' },
      { label: 'Guides', href: '#docs' },
      { label: 'API Reference', href: '#docs' },
      { label: 'SDKs', href: '#docs' },
      { label: 'Community', href: '#blog' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '#features' },
      { label: 'Blog', href: '#blog' },
      { label: 'Careers', href: '#blog' },
      { label: 'Contact', href: '#blog' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '#security' },
      { label: 'Terms of Service', href: '#security' },
      { label: 'Data Processing', href: '#security' },
      { label: 'Security', href: '#security' },
    ],
  },
];

const SOCIALS = [
  { href: 'https://github.com', label: 'GitHub', Icon: GithubIcon },
  { href: '#discord', label: 'Discord', Icon: MessageSquare },
  { href: '#terminal', label: 'Terminal', Icon: Terminal },
  { href: '#email', label: 'Email', Icon: Mail },
];

/**
 * Footer — Figma node 1:4543.
 * Island bbox (47.0, 1553.0, 870.0 x 119.0) → foother.svg (870 x 132; the path
 * runs 13px past the frame bottom and is clipped there, hence h-[110.9%]).
 * Newsletter panel is a #191919 inset at (722.8, 1554.9, 162.8 x 107.1).
 */
export function FigmaFooter({ className = '' }: { className?: string }) {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
      setTimeout(() => setSubscribed(false), 3000);
      setEmail('');
    }
  };

  return (
    <footer
      className={`relative z-10 w-full select-none px-4 py-6 sm:px-6 lg:aspect-[941/119] lg:overflow-hidden lg:px-0 lg:py-0 ${className}`}
    >
      <div className="@container relative w-full lg:absolute lg:left-[4.995%] lg:top-0 lg:h-[110.9%] lg:w-[92.455%]">
        <img
          src="/landing_components/foother.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 size-full object-fill filter invert dark:filter-none drop-shadow-sm transition-[filter] duration-300"
        />

        <div className="relative z-10 grid grid-cols-1 gap-8 px-6 py-8 md:grid-cols-2 lg:contents lg:gap-0 lg:px-0 lg:py-0">
          {/* Brand column — x 74.9 .. 195.4 of the island */}
          <div className="space-y-4 lg:absolute lg:left-[3.207cqw] lg:top-[5.97%] lg:w-[15cqw] lg:space-y-0">
            <Link
              href="/"
              className="flex shrink-0 cursor-pointer items-center lg:gap-[0.6cqw]"
            >
              <Logo
                size={42}
                markClassName="size-[26px] lg:size-[3.37cqw]"
                wordmark
                wordmarkClassName="text-base text-zinc-950 dark:text-white lg:text-[1.93cqw]"
              />
            </Link>

            <p className="max-w-xs text-xs leading-relaxed text-zinc-600 dark:text-zinc-400 lg:mt-[1.35cqw] lg:max-w-none lg:text-[1cqw] lg:leading-[1.55]">
              OpenID Connect identity platform for developers and teams who value security and freedom.
            </p>

            <div className="flex items-center gap-2.5 pt-1 lg:mt-[1.8cqw] lg:gap-[0.83cqw] lg:pt-0">
              {SOCIALS.map(({ href, label, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target={href.startsWith('http') ? '_blank' : undefined}
                  rel={href.startsWith('http') ? 'noreferrer' : undefined}
                  aria-label={label}
                  className="flex size-7 items-center justify-center rounded-full bg-black/5 border border-black/10 text-zinc-700 hover:text-black hover:bg-black/10 dark:bg-[#232324] dark:border-white/5 dark:text-zinc-400 dark:hover:text-white dark:hover:border-white/20 dark:hover:bg-zinc-800 transition-colors lg:size-[2.46cqw]"
                >
                  <Icon className="size-3.5 lg:size-[1.45cqw]" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns — 4 columns pitched 12.81% apart from x 275.6 */}
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 lg:absolute lg:left-[26.28%] lg:top-[3.45%] lg:w-[51.24%] lg:grid-cols-4 lg:gap-0">
            {FOOTER_COLUMNS.map((col) => (
              <div key={col.title} className="space-y-3 lg:space-y-0 lg:pr-[1cqw]">
                <h5 className="font-heading text-xs font-bold text-zinc-950 dark:text-white lg:text-[1.2cqw]">
                  {col.title}
                </h5>
                <ul className="space-y-2 text-[11px] lg:mt-[1.15cqw] lg:space-y-[0.62cqw] lg:text-[1.05cqw]">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white transition-colors duration-150"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Newsletter panel — #191919 inset at 77.68% / 1.60% of the island */}
          <div className="@container rounded-2xl bg-black/5 border border-black/10 dark:bg-[#191919] dark:border-white/5 p-5 md:col-span-2 lg:absolute lg:left-[77.68%] lg:top-[1.60%] lg:h-[90%] lg:w-[18.71%] lg:rounded-[1.6cqw] lg:p-[8.6cqw]">
            <h5 className="font-heading text-sm font-bold text-zinc-950 dark:text-white lg:text-[6.35cqw]">
              Stay in the loop
            </h5>
            <p className="mt-2 text-[11px] leading-snug text-zinc-600 dark:text-zinc-400 lg:mt-[7.4cqw] lg:text-[5.35cqw] lg:leading-[1.5]">
              Get updates on new features and releases.
            </p>

            <form
              onSubmit={handleSubscribe}
              className="relative mt-3 flex items-center lg:mt-[8cqw]"
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email"
                className="w-full rounded-full border border-zinc-300 bg-white px-4 py-2.5 pr-12 text-xs text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-800 dark:bg-[#0E0E0E] dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 lg:h-[13.14cqw] lg:px-[5.5cqw] lg:py-0 lg:pr-[15cqw] lg:text-[4.65cqw]"
              />
              <button
                type="submit"
                aria-label="Subscribe"
                className="absolute right-1.5 flex size-7 cursor-pointer items-center justify-center rounded-full bg-zinc-950 text-white dark:bg-[#F3F3F2] dark:text-zinc-950 shadow-sm transition-colors hover:scale-105 active:scale-95 lg:right-[1.2cqw] lg:size-[13.14cqw]"
              >
                <ArrowUpRight className="size-3.5 lg:size-[5cqw]" />
              </button>
            </form>

            {subscribed && (
              <p className="mt-2 text-xs text-emerald-500 dark:text-emerald-400 lg:mt-[4cqw] lg:text-[4cqw]">
                ✓ Subscribed!
              </p>
            )}
          </div>

          {/* Copyright — centred at y 87.31% of the island, no trailing gap */}
          <p className="text-center text-[11px] text-zinc-600 md:col-span-2 lg:absolute lg:left-[40.26%] lg:top-[87.31%] lg:text-[0.9cqw]">
            © 2026 OID. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
