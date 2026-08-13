'use client';

import { Zap, ShieldCheck, Activity, KeyRound, Database, RefreshCcw } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface CorePillarsProps {
  mode: 'user' | 'dev';
}

export function CorePillars({ mode }: CorePillarsProps) {
  const isDev = mode === 'dev';

  const pillars = isDev
    ? [
        {
          title: 'Stateless JWT Caching',
          eyebrow: '01_PERFORMANCE',
          desc: 'Sub-millisecond token validations using Redis-backed whitelist caching and stateless JSON Web Tokens.',
          icon: Zap,
          accent: 'border-emerald-500 bg-emerald-500/10 text-emerald-500',
        },
        {
          title: 'Append-Only Event Store',
          eyebrow: '02_RELIABILITY',
          desc: 'All security events are pushed to an asynchronous, partition-tolerant database that never blocks login handshakes.',
          icon: Database,
          accent: 'border-indigo-500 bg-indigo-500/10 text-indigo-500',
        },
        {
          title: 'Cryptographic RS256 Specs',
          eyebrow: '03_SECURITY',
          desc: 'Complies with full OpenID Connect standards using RS256 kid rotations, PKCE (S256) flow, and CSRF state validation.',
          icon: KeyRound,
          accent: 'border-amber-500 bg-amber-500/10 text-amber-500',
        },
      ]
    : [
        {
          title: 'Instant Logins',
          eyebrow: '01_SPEED',
          desc: 'Skip the passwords. Log in once and immediately hop between all connected tools without re-authenticating.',
          icon: Zap,
          accent: 'border-brand/20 bg-brand/10 text-brand',
        },
        {
          title: 'Always Connected',
          eyebrow: '02_STABILITY',
          desc: 'Your active sessions stay synced and live across all devices, ensuring you never get logged out mid-work.',
          icon: Activity,
          accent: 'border-brand/20 bg-brand/10 text-brand',
        },
        {
          title: 'Your Keys, Your Data',
          eyebrow: '03_PROTECTION',
          desc: 'High-grade local encryption shields your personal email and credentials, keeping third-party trackers out.',
          icon: ShieldCheck,
          accent: 'border-brand/20 bg-brand/10 text-brand',
        },
      ];

  return (
    <section id="pillars" className="relative z-10 mx-auto max-w-6xl px-6 py-16 border-t border-border/40">
      <div className="border-b border-border/40 pb-6 mb-8">
        <span className="eyebrow text-muted-foreground">
          {isDev ? '[ DEV_ARCHITECTURE_SPECS ]' : '[ CENTRAL_BENEFITS ]'}
        </span>
        <h2 className="font-heading text-3xl font-bold tracking-tight mt-1 text-foreground">
          {isDev ? 'UNDER THE HOOD' : 'FASTER. RELIABLE. SECURE.'}
        </h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-lg">
          {isDev
            ? 'Fully transparent OIDC protocol implementation designed for modern, high-performance web ecosystems.'
            : 'Experience frictionless navigation across all of Anand\'s projects without compromising on your security.'}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {pillars.map((p, idx) => {
          const Icon = p.icon;
          return (
            <Card
              key={idx}
              variant="gooey"
              className="group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between border-b border-border/40 pb-4 mb-4">
                  <span className="eyebrow text-[10px] text-muted-foreground">{p.eyebrow}</span>
                  <span className={`flex size-10 items-center justify-center border border-border/30 rounded-lg shadow-sm ${p.accent}`}>
                    <Icon className="size-5" />
                  </span>
                </div>
                <h3 className="font-heading text-lg font-bold tracking-tight text-foreground">{p.title}</h3>
                <p className="mt-2.5 text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
