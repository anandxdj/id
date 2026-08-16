'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { Logo } from '@/components/ui/logo';

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Security', href: '#security' },
  { label: 'Docs', href: '#docs' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Blog', href: '#blog' },
];

/**
 * Header — Figma node 1:4543, nav band 941 x 51.
 * Lockup spans x 57.7 → 130.8 (mark 29.3 wide + "OID" wordmark).
 * Nav item x-starts 345.0 / 422.8 / 498.0 / 560.3 / 629.8 — a flex row with a
 * 38.45px gap reproduces all five. CTA pill (812.3, 17.3, 108.3 x 36.5).
 * The design has no bottom divider.
 */
interface FigmaNavbarProps {
  primaryHref?: string;
}

export function FigmaNavbar({ primaryHref = '/login' }: FigmaNavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="@container sticky top-0 z-50 select-none bg-black/95 backdrop-blur-md transition-colors duration-200 lg:aspect-[941/51]">
      {/* < lg: ordinary flex bar */}
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5 sm:px-10 sm:py-4 lg:hidden">
        <Link href="/" className="flex shrink-0 cursor-pointer items-center">
          <Logo size={40} wordmark wordmarkClassName="text-xl text-white" />
        </Link>

        <nav className="hidden items-center justify-center gap-8 md:flex lg:gap-10">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="font-sans text-xs font-medium text-zinc-400 transition-colors duration-200 hover:text-white sm:text-[13px]"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="flex size-9 items-center justify-center rounded-full border border-white/15 text-white md:hidden"
          >
            {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
          <Link href={primaryHref}>
            <span className="inline-flex cursor-pointer items-center gap-2.5 rounded-full bg-white px-4.5 py-1.5 text-xs font-semibold text-black shadow-sm transition-all duration-150 hover:scale-105 hover:bg-zinc-100 active:scale-95 sm:text-[13px]">
              <span>Get Started</span>
              <span className="flex size-5 items-center justify-center rounded-full bg-black text-white">
                <ArrowUpRight className="size-3" />
              </span>
            </span>
          </Link>
        </div>
      </div>

      {menuOpen ? (
        <nav className="border-t border-white/10 px-6 py-4 md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-3">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="text-sm font-medium text-zinc-300 transition-colors hover:text-white"
              >
                {link.label}
              </a>
            ))}
          </div>
        </nav>
      ) : null}

      {/* lg+: absolute anchors measured off the 941-wide frame */}
      <div className="relative hidden size-full lg:block">
        <Link
          href="/"
          className="absolute left-[6.132cqw] top-[3.671cqw] flex -translate-y-1/2 cursor-pointer items-center gap-[0.776cqw]"
        >
          <Logo
            size={40}
            markClassName="size-[3.114cqw]"
            wordmark
            wordmarkClassName="text-[2.39cqw] text-white"
          />
        </Link>

        <nav className="absolute left-[36.663%] top-[3.858cqw] flex -translate-y-1/2 items-center gap-[4.086cqw]">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="font-sans text-[1.063cqw] font-medium leading-none text-zinc-400 transition-colors duration-200 hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <Link
          href={primaryHref}
          className="absolute left-[86.324%] top-[3.778cqw] w-[11.509%] -translate-y-1/2"
        >
          <button
            type="button"
            className="relative flex h-[3.879cqw] w-full cursor-pointer items-center rounded-full bg-[#F3F3F2] text-[0.935cqw] font-semibold leading-none text-black shadow-sm transition-all duration-150 hover:bg-white active:scale-95"
          >
            <span className="pl-[1.913cqw]">Get Started</span>
            <span className="absolute left-[71.19%] flex size-[2.858cqw] items-center justify-center rounded-full bg-black text-white">
              <ArrowUpRight className="size-[1.5cqw]" />
            </span>
          </button>
        </Link>
      </div>
    </header>
  );
}
