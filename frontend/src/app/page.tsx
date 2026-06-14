'use client';

import Link from 'next/link';
import { ArrowRight, KeyRound, ShieldCheck, Activity, Terminal, Users, Boxes } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { ScrambleText } from '@/features/landing/components/ScrambleText';
import { AuthFlowTerminal } from '@/features/landing/components/AuthFlowTerminal';

const FEATURES = [
  { n: '01', icon: KeyRound, title: 'OIDC engine', desc: 'authorize · consent · token · userinfo · discovery · JWKS. RS256 + PKCE S256, spec-compliant.' },
  { n: '02', icon: ShieldCheck, title: 'Sessions & revocation', desc: 'First-party sessions across devices. Revoke one, revoke everywhere, kill an app’s tokens instantly.' },
  { n: '03', icon: Users, title: 'Admin panel', desc: 'Owner-gated. Monitor users, suspend accounts, watch the live activity feed.' },
  { n: '04', icon: Terminal, title: 'Config-prompt generator', desc: 'Create a client → get an LLM prompt an agent pastes into a repo to wire OIDC automatically.' },
  { n: '05', icon: Activity, title: 'Append-only event store', desc: 'Every auth-significant action recorded, queryable, TTL-bounded. Fire-and-forget, never blocks auth.' },
  { n: '06', icon: Boxes, title: 'Social connectors', desc: 'Pluggable upstream IdPs bridged into one universal session. Mongo + Redis, no new infra.' },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* dot-grid backdrop */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.35]"
        style={{
          backgroundImage: 'radial-gradient(circle, var(--color-border) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* nav */}
      <header className="relative z-10 border-b-2 border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="font-heading text-2xl font-bold tracking-tight">id</span>
          <nav className="hidden items-center gap-6 md:flex">
            <a href="#features" className="eyebrow text-muted-foreground hover:text-foreground">FEATURES</a>
            <a href="#flow" className="eyebrow text-muted-foreground hover:text-foreground">FLOW</a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/login">
              <Button size="sm">Sign in</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* hero */}
      <section className="relative z-10 mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-2 lg:py-24">
        <div className="flex flex-col justify-center">
          <span className="eyebrow w-fit border-2 border-border bg-card px-2 py-1 text-muted-foreground shadow-brutal-xs">
            [ INTERNAL · UNIVERSAL SSO ]
          </span>
          <h1 className="mt-6 font-heading text-5xl font-bold leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
            ONE LOGIN
            <br />
            FOR EVERY
            <br />
            <ScrambleText text="INTERNAL APP" className="text-brand" />
          </h1>
          <p className="mt-6 max-w-md text-base text-muted-foreground">
            <span className="font-bold text-foreground">id</span> is the single OpenID Connect provider
            for all internal projects. Self-host the identity, ship apps that just trust{' '}
            <span className="font-mono text-foreground">id</span>.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login">
              <Button size="lg">
                Sign in <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Link href="/account">
              <Button size="lg" variant="secondary">
                Open dashboard
              </Button>
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap gap-x-8 gap-y-2">
            {['RS256', 'PKCE S256', 'OIDC DISCOVERY', 'JWKS'].map((s) => (
              <span key={s} className="eyebrow text-muted-foreground">
                ✓ {s}
              </span>
            ))}
          </div>
        </div>

        <div id="flow" className="flex items-center">
          <div className="w-full">
            <AuthFlowTerminal />
          </div>
        </div>
      </section>

      {/* statement band */}
      <section className="relative z-10 border-y-2 border-border bg-brand">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <p className="font-heading text-xl font-bold uppercase tracking-tight text-brand-foreground sm:text-2xl">
            Provision a client in the UI → paste the config-prompt → the app speaks OIDC. ///
          </p>
        </div>
      </section>

      {/* features */}
      <section id="features" className="relative z-10 mx-auto max-w-6xl px-6 py-20">
        <div className="mb-10 flex items-end justify-between border-b-2 border-border pb-5">
          <h2 className="font-heading text-3xl font-bold tracking-tight">WHAT IT DOES</h2>
          <span className="eyebrow hidden text-muted-foreground sm:block">[ 06_CAPABILITIES ]</span>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.n}
                className="group flex flex-col border-2 border-border bg-card p-5 shadow-brutal-sm transition-transform hover:-translate-x-1 hover:-translate-y-1 hover:shadow-brutal-lg"
              >
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center border-2 border-border bg-background">
                    <Icon className="size-5" />
                  </span>
                  <span className="eyebrow text-muted-foreground">{f.n}</span>
                </div>
                <h3 className="mt-4 font-heading text-lg font-bold tracking-tight">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
        <div className="flex flex-col items-center gap-6 border-2 border-border bg-card p-12 text-center shadow-brutal-lg">
          <h2 className="font-heading text-4xl font-bold tracking-tight">READY TO SIGN IN?</h2>
          <p className="max-w-md text-muted-foreground">
            Internal-only. One account, every app, full control over your sessions and grants.
          </p>
          <Link href="/login">
            <Button size="lg">
              Continue to login <ArrowRight className="size-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* footer */}
      <footer className="relative z-10 border-t-2 border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 sm:flex-row">
          <span className="font-heading text-lg font-bold tracking-tight">id</span>
          <p className="eyebrow text-muted-foreground">UNIVERSAL IDENTITY PROVIDER · OPENID CONNECT · INTERNAL</p>
        </div>
      </footer>
    </div>
  );
}
