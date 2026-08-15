'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, MessageSquare, Mail, Terminal } from 'lucide-react';

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

export function FooterOrganic() {
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

  const FOOTER_COLUMNS = [
    {
      title: 'Product',
      links: [
        { label: 'Features', href: '#features' },
        { label: 'Security', href: '#security' },
        { label: 'Pricing', href: '#pricing' },
        { label: 'Changelog', href: '#changelog' },
      ],
    },
    {
      title: 'Resources',
      links: [
        { label: 'Documentation', href: '#docs' },
        { label: 'Guides', href: '#guides' },
        { label: 'API Reference', href: '#api' },
        { label: 'Blog', href: '#blog' },
      ],
    },
    {
      title: 'Community',
      links: [
        { label: 'GitHub', href: 'https://github.com' },
        { label: 'Discussions', href: '#discussions' },
        { label: 'Contributing', href: '#contributing' },
        { label: 'Support', href: '#support' },
      ],
    },
    {
      title: 'Legal',
      links: [
        { label: 'Privacy Policy', href: '#privacy' },
        { label: 'Terms of Service', href: '#terms' },
        { label: 'Data Deletion', href: '#deletion' },
        { label: 'License', href: '#license' },
      ],
    },
  ];

  return (
    <footer className="relative z-10 bg-black text-zinc-400 select-none pt-4">
      <div className="mx-auto max-w-[1400px] px-6 sm:px-10 py-6 md:py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-8">
          {/* Column 1: Brand & Socials (3.5 cols) */}
          <div className="lg:col-span-3 space-y-4">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="flex items-center gap-1">
                <div className="size-6 rounded-full bg-white flex items-center justify-center shadow-sm">
                  <div className="size-2 rounded-full bg-black" />
                </div>
                <div className="size-3.5 rounded-full bg-white" />
              </div>
              <span className="font-heading font-black text-2xl tracking-tight text-white">
                OID
              </span>
            </Link>

            <p className="text-xs text-zinc-400 max-w-xs leading-relaxed">
              A self-hosted OpenID Connect provider for modern applications.
            </p>

            {/* Social Icons */}
            <div className="flex items-center gap-2.5 pt-1">
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                aria-label="GitHub"
                className="size-7 rounded-full bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors"
              >
                <GithubIcon className="size-3.5" />
              </a>
              <a
                href="#discord"
                aria-label="Discord"
                className="size-7 rounded-full bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors"
              >
                <MessageSquare className="size-3.5" />
              </a>
              <a
                href="#terminal"
                aria-label="Terminal"
                className="size-7 rounded-full bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors"
              >
                <Terminal className="size-3.5" />
              </a>
              <a
                href="#email"
                aria-label="Email"
                className="size-7 rounded-full bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors"
              >
                <Mail className="size-3.5" />
              </a>
            </div>
          </div>

          {/* Column 2: Navigation Links (5.5 cols) */}
          <div className="lg:col-span-5 grid grid-cols-2 sm:grid-cols-4 gap-6">
            {FOOTER_COLUMNS.map((col) => (
              <div key={col.title} className="space-y-3">
                <h5 className="font-heading font-bold text-xs text-white">
                  {col.title}
                </h5>
                <ul className="space-y-2 text-[11px]">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-zinc-400 hover:text-white transition-colors duration-150"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Column 3: Newsletter (3.5 cols) */}
          <div className="lg:col-span-4 space-y-3">
            <h5 className="font-heading font-bold text-xs sm:text-sm text-white">Stay in the loop</h5>
            <p className="text-[11px] text-zinc-400 leading-snug">Get updates on new features and releases.</p>

            <form onSubmit={handleSubscribe} className="relative flex items-center mt-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email"
                className="w-full rounded-full bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 pr-12"
              />
              <button
                type="submit"
                aria-label="Subscribe"
                className="cursor-pointer absolute right-1.5 size-7 rounded-full bg-white text-zinc-950 flex items-center justify-center hover:bg-zinc-200 transition-colors shadow-sm"
              >
                <ArrowUpRight className="size-3.5" />
              </button>
            </form>

            {subscribed && (
              <p className="text-[11px] text-emerald-400 font-medium animate-pulse">
                ✓ Thanks for subscribing!
              </p>
            )}
          </div>
        </div>

        {/* Bottom Copyright */}
        <div className="mt-12 pt-8 text-center text-[11px] text-zinc-600">
          <p>© 2024 OID. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

