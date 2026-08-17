'use client';

import Link from 'next/link';
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

  return (
    <header className="sticky top-0 z-50 border-b border-border/30 bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-2 sm:px-6 sm:py-2.5">
        {/* Brand Logo with Magnetic Interaction */}
        <div className="flex items-center gap-6 lg:gap-8">
          <MagneticButton strength={0.15}>
            <Link href="/" className="select-none flex items-center">
              <Logo size={34} />
            </Link>
          </MagneticButton>

          {/* Quick Anchor Navigation (Hidden on small mobile) */}
          <nav className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-xs font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        {/* Action Controls, Socials & Mode Switcher */}
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-3.5">
          {/* Social Links (GitHub & Twitter / X) */}
          <div className="hidden items-center gap-2 sm:flex">
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

          <div className="h-4 w-px bg-border/60 hidden sm:block" />

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
              <Button size="sm" variant="ghost" className="h-8 text-xs hidden sm:inline-flex" onClick={() => logout()}>
                Sign out
              </Button>
            </div>
          ) : (
            <MagneticButton strength={0.22}>
              <Link href="/login">
                <Button size="sm" className="h-8 rounded-full bg-foreground px-2.5 font-heading text-[11px] font-bold text-background transition-colors duration-300 hover:bg-foreground/90 sm:px-3.5 sm:text-xs">
                  Get Started
                </Button>
              </Link>
            </MagneticButton>
          )}
        </div>
      </div>
    </header>
  );
}
