'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Logo } from '@/components/ui/logo';

export function FigmaNavbar() {
  const navLinks = [
    { label: 'Features', href: '#features' },
    { label: 'Security', href: '#security' },
    { label: 'Docs', href: '#docs' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'Blog', href: '#blog' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-black/95 backdrop-blur-md border-b border-white/10 select-none transition-colors duration-200">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 sm:px-10 py-3.5 sm:py-4">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center shrink-0 cursor-pointer">
          <Logo size={40} />
        </Link>

        {/* Central Navigation Links */}
        <nav className="hidden md:flex items-center justify-center gap-8 lg:gap-10">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-xs sm:text-[13px] font-sans font-medium text-zinc-400 hover:text-white transition-colors duration-200"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Right CTA Button (Pill with circular arrow button) */}
        <div className="flex items-center gap-3 sm:gap-4">
          <Link href="/login">
            <button
              type="button"
              className="cursor-pointer inline-flex items-center gap-2.5 px-4.5 py-1.5 rounded-full bg-white text-black font-semibold text-xs sm:text-[13px] shadow-sm hover:bg-zinc-100 hover:scale-105 active:scale-95 transition-all duration-150"
            >
              <span>Get Started</span>
              <span className="size-5 rounded-full bg-black text-white flex items-center justify-center">
                <ArrowUpRight className="size-3" />
              </span>
            </button>
          </Link>
        </div>
      </div>
    </header>
  );
}
