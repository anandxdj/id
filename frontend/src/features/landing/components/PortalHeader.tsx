'use client';

import Link from 'next/link';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Logo } from '@/components/ui/logo';

interface PortalHeaderProps {
  mode: 'user' | 'dev';
  onModeChange?: (mode: 'user' | 'dev') => void;
}

export function PortalHeader({ mode, onModeChange }: PortalHeaderProps) {
  const { user, logout } = useAuth();
  const isDev = mode === 'dev';

  return (
    <header className="sticky top-0 z-50 border-b border-border/30 bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Brand Logo */}
        <Link href="/" className="select-none flex items-center">
          <Logo size={48} />
        </Link>
        
        {/* Central Mockup Navigation Links */}
        <nav className="hidden items-center justify-center gap-8 md:flex">
          <a href="#features" className="text-xs font-heading font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors duration-200">
            Features
          </a>
          <a href="#security" className="text-xs font-heading font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors duration-200">
            Security
          </a>
          <a href="#docs" className="text-xs font-heading font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors duration-200">
            Docs
          </a>
          <a href="#pricing" className="text-xs font-heading font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors duration-200">
            Pricing
          </a>
          <a href="#blog" className="text-xs font-heading font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors duration-200">
            Blog
          </a>
        </nav>
 
        {/* Action Controls & Mode Switcher */}
        <div className="flex items-center gap-4">
          {/* Smaller sliding mode toggle in navbar */}
          <div className="relative flex items-center bg-secondary/80 border border-border p-0.5 rounded-full w-24 h-7 text-[9px] font-mono select-none font-bold shadow-sm">
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

          <ThemeToggle />

          {user ? (
            <div className="flex items-center gap-3">
              <div className="hidden flex-col items-end text-right sm:flex">
                <span className="font-heading text-xs font-bold text-foreground">{user.name}</span>
              </div>
              <Link href="/account">
                <Button size="sm" variant="secondary" className="px-3">
                  Account
                </Button>
              </Link>
              <Button size="sm" variant="ghost" className="text-xs" onClick={() => logout()}>
                Sign out
              </Button>
            </div>
          ) : (
            <Link href="/login">
              <Button size="sm" className="rounded-full font-heading text-xs font-bold px-4 py-1.5 hover:bg-foreground hover:text-background transition-colors duration-300">
                Get Started
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
