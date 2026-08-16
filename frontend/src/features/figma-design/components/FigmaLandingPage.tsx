'use client';

import { useEffect, useRef, useState } from 'react';
import type { User } from '@/types';
import { X } from 'lucide-react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { AppEcosystem } from '@/features/landing/components/AppEcosystem';
import { AuthFlowTerminal } from '@/features/landing/components/AuthFlowTerminal';
import { FigmaAppsConsole } from './FigmaAppsConsole';
import { FigmaCorePillars } from './FigmaCorePillars';
import { FigmaCtaBanner } from './FigmaCtaBanner';
import { FigmaFooter } from './FigmaFooter';
import { FigmaHero } from './FigmaHero';
import { FigmaMidBanner } from './FigmaMidBanner';
import { FigmaNavbar } from './FigmaNavbar';
import { FigmaSecurityPrivacy } from './FigmaSecurityPrivacy';
import { FigmaTestimonials } from './FigmaTestimonials';

type LandingTool = 'apps' | 'api' | 'auth-flow' | null;

const TOOL_COPY: Record<Exclude<LandingTool, null>, { title: string; description: string }> = {
  apps: {
    title: 'Your application ecosystem',
    description: 'Review the applications connected to your identity.',
  },
  api: {
    title: 'OIDC API console',
    description: 'Use this authorization-code flow as a starting point for your integration.',
  },
  'auth-flow': {
    title: 'Authentication flow',
    description: 'Watch the OIDC authorization-code exchange step by step.',
  },
};

function LandingToolOverlay({
  tool,
  user,
  onClose,
  onSelect,
}: {
  tool: Exclude<LandingTool, null>;
  user: User | null;
  onClose: () => void;
  onSelect: (tool: Exclude<LandingTool, null>) => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const copy = TOOL_COPY[tool];

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="landing-tool-title"
        className="max-h-[90dvh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-white/10 bg-[#111112] text-white shadow-2xl"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-[#111112]/95 px-5 py-4 backdrop-blur sm:px-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">OID platform</p>
            <h2 id="landing-tool-title" className="mt-1 font-heading text-xl font-black tracking-tight">
              {copy.title}
            </h2>
            <p className="mt-1 text-sm text-zinc-400">{copy.description}</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close platform tools"
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/15 text-zinc-300 transition-colors hover:bg-white hover:text-black"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="flex gap-2 overflow-x-auto border-b border-white/10 px-5 py-3 sm:px-7">
          {(Object.keys(TOOL_COPY) as Exclude<LandingTool, null>[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onSelect(item)}
              aria-pressed={tool === item}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                tool === item ? 'bg-white text-black' : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              {TOOL_COPY[item].title}
            </button>
          ))}
        </div>

        <div className="p-5 sm:p-7">
          {tool === 'apps' ? <AppEcosystem user={user} /> : null}
          {tool === 'auth-flow' ? <AuthFlowTerminal /> : null}
          {tool === 'api' ? (
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0B0F19]">
              <div className="border-b border-white/10 px-5 py-3 font-mono text-xs text-zinc-400">authorization-code + PKCE</div>
              <pre className="overflow-x-auto p-5 text-xs leading-relaxed text-emerald-300 sm:text-sm">{`curl -X POST https://id.anand.dev/oauth/token \\
  -d "grant_type=authorization_code" \\
  -d "client_id=acme_app" \\
  -d "code_challenge=PKCE_CHALLENGE"`}</pre>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

/** Shared Figma-traced landing composition used by both / and /design. */
export function FigmaLandingPage() {
  const { user, loading } = useAuth();
  const [tool, setTool] = useState<LandingTool>(null);
  const primaryHref = user ? '/account' : '/login';

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-sm font-medium text-muted-foreground">Loading OID…</div>;
  }

  return (
    <div className="relative min-h-screen overflow-x-clip bg-background font-sans text-foreground transition-colors duration-300">
      <FigmaNavbar primaryHref={primaryHref} />

      <main className="relative z-10 flex flex-col gap-6 pb-10 lg:block lg:gap-0 lg:pb-0">
        <FigmaHero primaryHref={primaryHref} />
        <div id="features" className="lg:flow-root">
          <FigmaCorePillars className="lg:-mt-[0.383%]" />
        </div>
        <div id="docs" className="lg:flow-root">
          <FigmaAppsConsole className="lg:mt-[0.691%]" primaryHref={primaryHref} onOpenTool={setTool} />
        </div>
        <FigmaMidBanner className="lg:mt-[0.298%]" />
        <div id="security" className="lg:flow-root">
          <FigmaSecurityPrivacy />
        </div>
        <div id="blog" className="lg:flow-root">
          <FigmaTestimonials className="lg:mt-[0.808%]" />
        </div>
        <div id="pricing" className="lg:flow-root">
          <FigmaCtaBanner className="lg:-mt-[0.468%]" primaryHref={primaryHref} />
        </div>
        <FigmaFooter className="lg:mt-[1.275%]" />
      </main>

      {tool ? <LandingToolOverlay tool={tool} user={user} onClose={() => setTool(null)} onSelect={setTool} /> : null}
    </div>
  );
}
