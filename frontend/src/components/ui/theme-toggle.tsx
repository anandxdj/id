'use client';

import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'circle' | 'gif';

/**
 * Drop your custom theme-swap GIF here (or set NEXT_PUBLIC_THEME_GIF_URL).
 * While empty, the toggle gracefully falls back to the View-Transition circle reveal.
 */
export const THEME_GIF_URL = process.env.NEXT_PUBLIC_THEME_GIF_URL ?? '';

interface ThemeToggleProps {
  /** @default 'gif' (falls back to 'circle' automatically when no gifUrl is set) */
  variant?: Variant;
  /** GIF played fullscreen during the swap when variant='gif' @default THEME_GIF_URL */
  gifUrl?: string;
  /** ms the gif overlay stays up @default 1100 */
  gifDuration?: number;
  className?: string;
}

const supportsVT = () =>
  typeof document !== 'undefined' && typeof document.startViewTransition === 'function';

export function ThemeToggle({
  variant = 'gif',
  gifUrl = THEME_GIF_URL,
  gifDuration = 1100,
  className,
}: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [gifOn, setGifOn] = useState(false);
  const gifTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (gifTimer.current) clearTimeout(gifTimer.current);
    };
  }, []);

  const isDark = resolvedTheme === 'dark';

  const toggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    const next = isDark ? 'light' : 'dark';

    if (variant === 'gif' && gifUrl) {
      setGifOn(true);
      gifTimer.current = setTimeout(() => setGifOn(false), gifDuration);
      setTheme(next);
      return;
    }

    // circle reveal via View Transition API (graceful no-op fallback)
    if (!supportsVT()) {
      setTheme(next);
      return;
    }
    const x = e.clientX;
    const y = e.clientY;
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const root = document.documentElement;
    root.style.setProperty('--vt-x', `${x}px`);
    root.style.setProperty('--vt-y', `${y}px`);
    root.style.setProperty('--vt-r', `${r}px`);
    document.startViewTransition(() => setTheme(next)).ready.catch(() => {});
  };

  // pre-hydration placeholder (prevents layout shift / wrong icon flash)
  if (!mounted) {
    return (
      <div
        aria-hidden
        className={cn('size-9 border-2 border-border bg-card shadow-brutal-xs', className)}
      />
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        className={cn(
          'inline-flex size-9 items-center justify-center border-2 border-border bg-card text-foreground',
          'shadow-brutal-xs transition-transform',
          'hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal-sm',
          'active:translate-x-0 active:translate-y-0 active:shadow-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          className,
        )}
      >
        {isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
      </button>

      {gifOn && gifUrl && (
        <div className="pointer-events-none fixed inset-0 z-[9999] grid place-items-center bg-background/90 backdrop-blur-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={gifUrl}
            alt=""
            className="max-h-[40vh] max-w-[40vw] border-2 border-border shadow-brutal-lg"
          />
        </div>
      )}
    </>
  );
}
