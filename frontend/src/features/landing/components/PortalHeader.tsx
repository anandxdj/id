'use client';

import Link from 'next/link';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Logo } from '@/components/ui/logo';
import { MagneticButton } from '@/components/ui/gooey';

interface PortalHeaderProps {
  mode: 'user' | 'dev';
  onModeChange?: (mode: 'user' | 'dev') => void;
}

export function PortalHeader({ mode, onModeChange }: PortalHeaderProps) {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-border/30 bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-2 sm:py-2.5">
        {/* Brand Logo with Magnetic Interaction */}
        <MagneticButton strength={0.15}>
          <Link href="/" className="select-none flex items-center">
            <Logo size={34} />
          </Link>
        </MagneticButton>

        {/* Action Controls & Mode Switcher */}
        <div className="flex items-center gap-3 sm:gap-4">
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

          <ThemeToggle className="size-8" />

          {user ? (
            <div className="flex items-center gap-3">
              <div className="hidden flex-col items-end text-right sm:flex">
                <span className="font-heading text-xs font-bold text-foreground">{user.name}</span>
              </div>
              <MagneticButton strength={0.2}>
                <Link href="/account">
                  <Button size="sm" variant="secondary" className="h-8 px-3 text-xs">
                    Account
                  </Button>
                </Link>
              </MagneticButton>
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => logout()}>
                Sign out
              </Button>
            </div>
          ) : (
            <MagneticButton strength={0.22}>
              <Link href="/login">
                <Button size="sm" className="h-8 rounded-full font-heading text-xs font-bold px-3.5 bg-foreground text-background hover:bg-foreground/90 transition-colors duration-300">
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
