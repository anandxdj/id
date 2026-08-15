'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { Logo } from '@/components/ui/logo';
import { ThemeToggle } from '@/components/ui/theme-toggle';

interface OrganicNavbarProps {
  mode?: 'user' | 'dev';
  onModeChange?: (mode: 'user' | 'dev') => void;
  onCtaClick?: () => void;
}

export function OrganicNavbar({ mode, onModeChange, onCtaClick }: OrganicNavbarProps) {
  const { user, logout } = useAuth();
  const [internalMode, setInternalMode] = useState<'user' | 'dev'>('user');
  const currentMode = mode ?? internalMode;

  const handleModeToggle = (nextMode: 'user' | 'dev') => {
    setInternalMode(nextMode);
    onModeChange?.(nextMode);
  };

  const navLinks = [
    { label: 'FEATURES', href: '#features' },
    { label: 'SECURITY', href: '#security' },
    { label: 'DOCS', href: '#docs' },
    { label: 'PRICING', href: '#pricing' },
    { label: 'BLOG', href: '#blog' },
  ];

  // User display initials (defaults to 'DJ' matching mockup if no user name)
  const displayName = user?.name || 'DJ';
  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || user.name.slice(0, 2).toUpperCase()
    : 'DJ';

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/90 backdrop-blur-md select-none transition-colors duration-200">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 sm:px-10 py-3.5 sm:py-4">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center shrink-0 cursor-pointer">
          <Logo size={42} />
        </Link>

        {/* Central Mockup Navigation Links */}
        <nav className="hidden md:flex items-center justify-center gap-8 lg:gap-10">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-xs font-heading font-semibold uppercase tracking-wider text-zinc-400 hover:text-white transition-colors duration-200"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Action Controls & Mode Switcher */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* USER / DEV Sliding Mode Toggle */}
          <div className="relative flex items-center bg-zinc-900 border border-zinc-800 p-0.5 rounded-full w-24 h-7 text-[9px] font-mono select-none font-bold shadow-sm">
            <div
              className="absolute top-0.5 bottom-0.5 rounded-full bg-white shadow-sm transition-all duration-300"
              style={{
                left: currentMode === 'user' ? '2px' : 'calc(50% + 1px)',
                width: 'calc(50% - 3px)',
              }}
            />
            <button
              type="button"
              onClick={() => handleModeToggle('user')}
              className={`flex-1 text-center z-10 transition-colors duration-200 cursor-pointer ${
                currentMode === 'user'
                  ? 'text-black font-black'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              USER
            </button>
            <button
              type="button"
              onClick={() => handleModeToggle('dev')}
              className={`flex-1 text-center z-10 transition-colors duration-200 cursor-pointer ${
                currentMode === 'dev'
                  ? 'text-black font-black'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              DEV
            </button>
          </div>

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* User Display / Action Buttons */}
          <div className="flex items-center gap-3">
            <span className="font-heading text-xs sm:text-sm font-bold text-white tracking-tight select-none">
              {displayName.length <= 4 ? displayName : initials}
            </span>

            <Link href="/account">
              <button
                type="button"
                className="cursor-pointer rounded-full bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white text-xs font-semibold px-3.5 sm:px-4 py-1.5 shadow-sm transition-all duration-150 active:scale-95"
              >
                Account
              </button>
            </Link>

            <button
              type="button"
              onClick={() => logout()}
              className="cursor-pointer text-xs font-medium text-zinc-400 hover:text-white transition-colors duration-150"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
