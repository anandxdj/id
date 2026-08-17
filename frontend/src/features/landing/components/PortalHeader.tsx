'use client';

import { useEffect, useRef, useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Logo } from '@/components/ui/logo';
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

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Docs', href: '#docs' },
  { label: 'Security', href: '#security' },
  { label: 'Pricing', href: '#pricing' },
];

interface PortalHeaderProps {
  mode: 'user' | 'dev';
  onModeChange?: (mode: 'user' | 'dev') => void;
}

export function PortalHeader({ mode, onModeChange }: PortalHeaderProps) {
  const { user, logout } = useAuth();
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const updateActiveSection = () => {
      const headerHeight = headerRef.current?.offsetHeight ?? 0;
      const marker = headerHeight + Math.min(window.innerHeight * 0.24, 180);
      let current: string | null = null;

      for (const link of NAV_LINKS) {
        const section = document.querySelector<HTMLElement>(link.href);
        if (!section) continue;
        const rect = section.getBoundingClientRect();
        if (rect.top <= marker && rect.bottom > headerHeight + 24) current = link.href;
      }

      setActiveSection(current);
    };

    updateActiveSection();
    window.addEventListener('scroll', updateActiveSection, { passive: true });
    window.addEventListener('resize', updateActiveSection);
    return () => {
      window.removeEventListener('scroll', updateActiveSection);
      window.removeEventListener('resize', updateActiveSection);
      if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
    };
  }, []);

  const scrollToSection = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    const section = document.querySelector<HTMLElement>(href);
    if (!section) return;

    event.preventDefault();
    if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);

    const headerHeight = headerRef.current?.offsetHeight ?? 0;
    const start = window.scrollY;
    const destination = Math.max(0, section.getBoundingClientRect().top + start - headerHeight - 16);

    if (prefersReducedMotion) {
      window.scrollTo({ top: destination });
      window.history.replaceState(null, '', href);
      setActiveSection(href);
      return;
    }

    let startedAt: number | null = null;
    const duration = 720;
    const animateScroll = (now: number) => {
      startedAt ??= now;
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      window.scrollTo(0, start + (destination - start) * eased);

      if (progress < 1) {
        scrollFrameRef.current = requestAnimationFrame(animateScroll);
      } else {
        scrollFrameRef.current = null;
        window.history.replaceState(null, '', href);
        setActiveSection(href);
      }
    };

    scrollFrameRef.current = requestAnimationFrame(animateScroll);
  };

  return (
    <header ref={headerRef} className="sticky top-0 z-50 border-b border-border/40 bg-background/90 shadow-[0_10px_30px_-24px_rgba(0,0,0,0.7)] backdrop-blur-xl">
      <div className="relative mx-auto max-w-7xl px-3 py-2 sm:px-6 sm:py-2.5">
        <div className="flex items-center justify-between gap-3">
        {/* Brand Logo with Magnetic Interaction */}
        <div className="flex shrink-0 items-center">
          <MagneticButton strength={0.15}>
            <Link href="/" className="select-none flex items-center">
              <Logo size={34} />
            </Link>
          </MagneticButton>
        </div>

        {/* Action Controls, Socials & Mode Switcher */}
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-3.5">
          {/* Social Links (GitHub & Twitter / X) */}
          <div className="hidden items-center gap-2 xl:flex">
            <MagneticButton strength={0.2}>
              <a
                href="https://github.com/anandxdj/id"
                target="_blank"
                rel="noreferrer"
                aria-label="GitHub Repository (anandxdj/id)"
                title="GitHub: anandxdj/id"
                className="group flex h-8 items-center gap-1.5 rounded-full border border-border/70 bg-secondary/50 px-2.5 sm:px-3 text-xs font-medium text-foreground transition-all duration-200 hover:border-foreground/30 hover:bg-secondary"
              >
                <GithubIcon className="size-3.5 text-muted-foreground transition-colors group-hover:text-foreground" />
                <span className="hidden xl:inline text-[11px] font-mono text-muted-foreground group-hover:text-foreground">
                  anandxdj/id
                </span>
              </a>
            </MagneticButton>

            <MagneticButton strength={0.2}>
              <a
                href="https://x.com/anandxdj"
                target="_blank"
                rel="noreferrer"
                aria-label="Twitter / X Account (@anandxdj)"
                title="Twitter / X: @anandxdj"
                className="group flex size-8 items-center justify-center rounded-full border border-border/70 bg-secondary/50 text-foreground transition-all duration-200 hover:border-foreground/30 hover:bg-secondary"
              >
                <XTwitterIcon className="size-3.5 text-muted-foreground transition-colors group-hover:text-foreground" />
              </a>
            </MagneticButton>
          </div>

          <div className="hidden h-4 w-px bg-border/60 xl:block" />

          {/* Sliding mode toggle in navbar */}
          <div className="relative hidden h-7 w-24 select-none items-center rounded-full border border-border bg-secondary/80 p-0.5 font-mono text-[9px] font-bold shadow-sm min-[380px]:flex">
            <div 
              className="absolute top-0.5 bottom-0.5 rounded-full bg-foreground shadow-sm transition-all duration-300"
              style={{
                left: mode === 'user' ? '2px' : 'calc(50% + 1px)',
                width: 'calc(50% - 3px)'
              }}
            />
            <button 
              onClick={() => onModeChange?.('user')}
              className={`flex-1 text-center z-10 transition-colors duration-200 cursor-pointer ${mode === 'user' ? 'text-background font-black' : 'text-muted-foreground hover:text-foreground'}`}
            >
              USER
            </button>
            <button 
              onClick={() => onModeChange?.('dev')}
              className={`flex-1 text-center z-10 transition-colors duration-200 cursor-pointer ${mode === 'dev' ? 'text-background font-black' : 'text-muted-foreground hover:text-foreground'}`}
            >
              DEV
            </button>
          </div>

          <ThemeToggle className="size-8" />

          {user ? (
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden flex-col items-end text-right lg:flex">
                <span className="font-heading text-xs font-bold text-foreground">{user.name}</span>
              </div>
              <MagneticButton strength={0.2}>
                <Link href="/account">
                  <Button size="sm" variant="secondary" className="h-8 px-3 text-xs">
                    Account
                  </Button>
                </Link>
              </MagneticButton>
              <Button size="sm" variant="ghost" className="hidden h-8 text-xs xl:inline-flex" onClick={() => logout()}>
                Sign out
              </Button>
            </div>
          ) : (
            <MagneticButton strength={0.22}>
              <Link href="/login">
                <Button size="sm" className="h-8 rounded-full bg-foreground px-2.5 font-heading text-[11px] font-bold text-background transition-colors duration-300 hover:bg-foreground/90 sm:px-3.5 sm:text-xs">
                  Sign in
                </Button>
              </Link>
            </MagneticButton>
          )}
        </div>
        </div>

        <nav
          aria-label="Landing page sections"
          className="mt-2 grid grid-cols-4 rounded-full border border-border/60 bg-secondary/70 p-1 shadow-sm md:absolute md:left-1/2 md:top-1/2 md:mt-0 md:flex md:-translate-x-1/2 md:-translate-y-1/2 md:items-center"
        >
          {NAV_LINKS.map((link) => {
            const active = activeSection === link.href;
            return (
              <motion.a
                key={link.label}
                href={link.href}
                onClick={(event) => scrollToSection(event, link.href)}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
                aria-current={active ? 'location' : undefined}
                className={`relative flex h-8 items-center justify-center rounded-full px-2.5 font-mono text-[10px] font-bold uppercase tracking-wide outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:px-3 md:h-7 md:text-[9px] ${
                  active ? 'text-background' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {active ? (
                  <motion.span
                    layoutId="landing-nav-active"
                    className="absolute inset-0 rounded-full bg-foreground shadow-sm"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                ) : null}
                <span className="relative z-10">{link.label}</span>
              </motion.a>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
