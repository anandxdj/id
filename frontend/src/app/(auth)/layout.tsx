import Link from 'next/link';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Logo } from '@/components/ui/logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
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
      <header className="relative z-10 flex items-center justify-between border-b-2 border-border px-6 py-3">
        <Link href="/" className="select-none flex items-center">
          <Logo size={48} />
        </Link>
        <ThemeToggle />
      </header>

      {/* centered content */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-12">
        <p className="eyebrow mb-5 text-muted-foreground">[ SECURE_SSO · INTERNAL_ONLY ]</p>
        {children}
      </main>

      {/* footer line */}
      <footer className="relative z-10 border-t-2 border-border px-6 py-3">
        <p className="eyebrow text-muted-foreground">
          UNIVERSAL IDENTITY PROVIDER · OPENID CONNECT
        </p>
      </footer>
    </div>
  );
}
