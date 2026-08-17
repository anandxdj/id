import Link from 'next/link';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Logo } from '@/components/ui/logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip bg-background">
      {/* brutalist dot-grid backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.4]"
        style={{
          backgroundImage:
            'radial-gradient(circle, var(--color-border) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      />

      {/* top bar: logo + theme toggle */}
      <header className="relative z-10 flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
        <Link href="/" className="select-none flex items-center">
          <Logo size={48} />
        </Link>
        <ThemeToggle />
      </header>

      {/* centered content */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
        <div className="w-full max-w-md">
          <p className="eyebrow mb-5 text-center text-muted-foreground">
            [ SECURE_SSO · INTERNAL_ONLY ]
          </p>
          {children}
        </div>
      </main>

      {/* footer line */}
      <footer className="relative z-10 border-t border-border px-4 py-3 sm:px-6">
        <p className="eyebrow text-center text-muted-foreground sm:text-left">
          UNIVERSAL IDENTITY PROVIDER · OPENID CONNECT
        </p>
      </footer>
    </div>
  );
}
