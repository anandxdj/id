'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  createAnimation,
  type AnimationVariant,
  type AnimationStart,
} from '@/components/ui/skiper-ui/skiper26';

/**
 * Theme-swap GIF(s). High-contrast GIFs work best — each is used as a View
 * Transition mask. Set NEXT_PUBLIC_THEME_GIF_URL in frontend/.env to one URL,
 * or several separated by commas / newlines — one is picked at random per swap.
 * Empty → circle-blur reveal fallback.
 */
export const THEME_GIF_URLS: string[] = (process.env.NEXT_PUBLIC_THEME_GIF_URL ?? '')
  .split(/[\n,]+/)
  .map((u) => u.trim())
  .filter(Boolean);

const STYLE_ID = 'theme-transition-styles';

function injectStyles(css: string) {
  if (typeof document === 'undefined') return;
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = css;
}

interface ThemeToggleProps {
  /** Animation variant @default 'gif' when GIFs exist, else 'circle-blur' */
  variant?: AnimationVariant;
  /** Reveal origin for non-gif variants @default 'center' */
  start?: AnimationStart;
  /** Override the GIF pool (defaults to THEME_GIF_URLS from env) */
  gifUrls?: string[];
  blur?: boolean;
  className?: string;
}

/**
 * Brutalist square toggle driven by skiper26's View Transition engine.
 * With multiple GIFs configured, a random one (never the same twice in a row)
 * masks each swap. Falls back to circle-blur when no GIF is set, and to a plain
 * theme swap on browsers without the View Transition API.
 */
export function ThemeToggle({
  variant,
  start = 'center',
  gifUrls = THEME_GIF_URLS,
  blur = false,
  className,
}: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const lastGifIndex = useRef(-1);

  useEffect(() => setMounted(true), []);

  const pickGif = useCallback(() => {
    if (gifUrls.length === 0) return '';
    if (gifUrls.length === 1) return gifUrls[0];
    let i = Math.floor(Math.random() * gifUrls.length);
    if (i === lastGifIndex.current) i = (i + 1) % gifUrls.length; // no immediate repeat
    lastGifIndex.current = i;
    return gifUrls[i];
  }, [gifUrls]);

  const toggle = useCallback(() => {
    const gif = pickGif();
    const resolvedVariant: AnimationVariant = variant ?? (gif ? 'gif' : 'circle-blur');
    const next = resolvedTheme === 'dark' ? 'light' : 'dark';

    const animation = createAnimation(resolvedVariant, start, blur, gif);
    injectStyles(animation.css);

    if (typeof document === 'undefined' || !document.startViewTransition) {
      setTheme(next);
      return;
    }
    document.startViewTransition(() => setTheme(next));
  }, [pickGif, variant, start, blur, resolvedTheme, setTheme]);

  const isDark = resolvedTheme === 'dark';

  // pre-hydration placeholder (prevents layout shift / wrong icon flash)
  if (!mounted) {
    return (
      <div
        aria-hidden
        className={cn('size-9 border border-[var(--organic-border)] bg-[var(--organic-bg)] shape-organic-sm shadow-sm', className)}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={cn(
        'inline-flex size-9 items-center justify-center border border-[var(--organic-border)] bg-[var(--organic-bg)] text-[var(--organic-foreground)] shape-organic-sm cursor-pointer',
        'shadow-sm transition-all duration-300',
        'hover:rotate-6 hover:scale-105 active:scale-90',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        className,
      )}
    >
      {isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </button>
  );
}
