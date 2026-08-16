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
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-md select-none transition-colors duration-200">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 sm:px-10 py-2 sm:py-2.5">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center shrink-0 cursor-pointer">
          <Logo size={34} />
        </Link>

        {/* Action Controls & Mode Switcher */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* USER / DEV Sliding Mode Toggle */}
          <div className="relative flex items-center bg-muted/80 border border-border p-0.5 rounded-full w-24 h-7 text-[9px] font-mono select-none font-bold shadow-sm">
            <div
              className="absolute top-0.5 bottom-0.5 rounded-full bg-foreground shadow-sm transition-all duration-300"
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
                  ? 'text-background font-black'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              USER
            </button>
            <button
              type="button"
              onClick={() => handleModeToggle('dev')}
              className={`flex-1 text-center z-10 transition-colors duration-200 cursor-pointer ${
                currentMode === 'dev'
                  ? 'text-background font-black'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              DEV
            </button>
          </div>

          {/* Theme Toggle */}
          <ThemeToggle className="size-8" />

          {/* User Display / Action Buttons */}
          <div className="flex items-center gap-3">
            <span className="font-heading text-xs sm:text-sm font-bold text-foreground tracking-tight select-none">
              {displayName.length <= 4 ? displayName : initials}
            </span>

            <Link href="/account">
              <button
                type="button"
                className="cursor-pointer rounded-full bg-secondary border border-border hover:bg-secondary/80 text-foreground text-xs font-semibold px-3 py-1 shadow-sm transition-all duration-150 active:scale-95"
              >
                Account
              </button>
            </Link>

            <button
              type="button"
              onClick={() => logout()}
              className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground transition-colors duration-150"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
