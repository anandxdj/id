'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowUpRight, MessageSquare, Mail, Terminal } from 'lucide-react';
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

interface FooterOrganicProps {
  className?: string;
}

export function FooterOrganic({ className = '' }: FooterOrganicProps) {
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
    <footer className={`relative mx-auto max-w-[1600px] px-4 sm:px-8 py-1 sm:py-2 select-none ${className}`}>
      {/* Dark Organic Blob Island Container */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full aspect-[870/132] min-h-[240px] md:min-h-[260px] lg:min-h-[280px] flex flex-col justify-between p-5 sm:p-7 md:p-8 lg:px-12 lg:py-6 select-none"
      >
        {/* Background SVG */}
        <img
          src="/landing_components/foother.svg"
          alt=""
          className="absolute inset-0 w-full h-full object-fill pointer-events-none z-0 scale-[1.01] animate-island-breathe filter invert dark:filter-none drop-shadow-sm transition-[filter] duration-300"
          aria-hidden="true"
        />

        {/* Inner Content Layer */}
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-6 items-start w-full">
          {/* Column 1: Brand & Socials */}
          <div className="lg:col-span-3 space-y-3">
            <Link href="/" className="flex items-center gap-2.5 group w-fit">
              <div className="flex items-center gap-1 transition-transform duration-200 group-hover:scale-110">
                <div className="size-5 sm:size-6 rounded-full bg-zinc-950 dark:bg-white flex items-center justify-center shadow-xs">
                  <div className="size-2 rounded-full bg-white dark:bg-black" />
                </div>
                <div className="size-3 sm:size-3.5 rounded-full bg-zinc-950 dark:bg-white" />
              </div>
              <span className="font-heading font-black text-xl sm:text-2xl tracking-tight text-zinc-950 dark:text-white">
                OID
              </span>
            </Link>

            <p className="text-[11px] sm:text-xs text-zinc-600 dark:text-zinc-400 max-w-xs leading-relaxed">
              A self-hosted OpenID Connect provider for modern applications.
            </p>

            {/* Social Icons with Magnetic Hover */}
            <div className="flex items-center gap-2 pt-1">
              {[
                { href: 'https://github.com', icon: GithubIcon, label: 'GitHub' },
                { href: '#discord', icon: MessageSquare, label: 'Discord' },
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
                      className="size-7 rounded-full bg-black/5 border border-black/10 text-zinc-700 hover:text-black hover:bg-black/10 dark:bg-[#232324] dark:border-white/5 dark:text-zinc-400 dark:hover:text-white dark:hover:border-white/20 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors"
                    >
                      <Icon className="size-3.5" />
                    </a>
                  </MagneticButton>
                );
              })}
            </div>
          </div>

          {/* Column 2: Navigation Links */}
          <div className="lg:col-span-5 grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
            {FOOTER_COLUMNS.map((col) => (
              <div key={col.title} className="space-y-2">
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

          {/* Column 3: Newsletter */}
          <div className="lg:col-span-4 rounded-2xl bg-black/5 border border-black/10 dark:bg-[#191919] dark:border-white/5 p-4 sm:p-5 space-y-2">
            <h5 className="font-heading font-bold text-xs sm:text-sm text-zinc-950 dark:text-white">Stay in the loop</h5>
            <p className="text-[10.5px] sm:text-[11px] text-zinc-600 dark:text-zinc-400 leading-snug">Get updates on new features and releases.</p>

            <form onSubmit={handleSubscribe} className="relative flex items-center mt-2.5">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email"
                className="w-full rounded-full bg-white border border-zinc-300 px-3.5 py-2 text-xs text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-500 dark:bg-[#0E0E0E] dark:border-zinc-800 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 pr-10"
              />
              <button
                type="submit"
                aria-label="Subscribe"
                className="cursor-pointer absolute right-1 size-6.5 rounded-full bg-zinc-950 text-white dark:bg-[#F3F3F2] dark:text-zinc-950 flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xs"
              >
                <ArrowUpRight className="size-3.5" />
              </button>
            </form>

            {subscribed && (
              <p className="text-[10.5px] text-emerald-500 dark:text-emerald-400 font-medium animate-pulse">
                ✓ Thanks for subscribing!
              </p>
            )}
          </div>
        </div>

        {/* Bottom Copyright */}
        <div className="relative z-10 mt-4 text-center text-[10.5px] sm:text-[11px] text-zinc-600 dark:text-zinc-500">
          <p>© 2026 OID. All rights reserved.</p>
        </div>
      </motion.div>
    </footer>
  );
}
