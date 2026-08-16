'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Terminal, X } from 'lucide-react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { PortalHeader } from '@/features/landing/components/PortalHeader';
import { AppEcosystem } from '@/features/landing/components/AppEcosystem';
import { AuthFlowTerminal } from '@/features/landing/components/AuthFlowTerminal';
import { FigmaHero, FigmaTestimonials } from '@/features/figma-design';
import {
  AppsConsoleOrganic,
  CorePillarsOrganic,
  CtaBannerOrganic,
  FooterOrganic,
  MidValueBanner,
  SecurityPrivacyOrganic,
} from '@/features/organic-landing';

export default function LandingPage() {
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<'user' | 'dev'>('user');
  const [, setConnectedAppsCount] = useState(0);
  const [showFullEcosystem, setShowFullEcosystem] = useState(false);
  const [activeConsoleCard, setActiveConsoleCard] = useState<string | null>(null);

  // Sync mode with localStorage across sessions
  useEffect(() => {
    try {
      const savedMode = localStorage.getItem('oid_landing_mode');
      if (savedMode === 'user' || savedMode === 'dev') {
        setMode(savedMode);
      }
    } catch {
      // Ignore localStorage access errors if restricted
    }
  }, []);

  const handleModeChange = (nextMode: 'user' | 'dev') => {
    setMode(nextMode);
    try {
      localStorage.setItem('oid_landing_mode', nextMode);
    } catch {
      // Ignore localStorage write errors
    }
  };

  const handleConsoleCard = (id: string) => {
    if (id === 'dashboard') {
      setShowFullEcosystem(true);
      requestAnimationFrame(() => document.getElementById('ecosystem-panel')?.scrollIntoView({ behavior: 'smooth' }));
      return;
    }

    if (mode === 'dev' && (id === 'api' || id === 'logs')) {
      setActiveConsoleCard((current) => (current === id ? null : id));
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="eyebrow animate-pulse text-muted-foreground">ESTABLISHING ID SESSION…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-clip bg-background text-foreground transition-colors duration-300">
      <PortalHeader mode={mode} onModeChange={handleModeChange} />

      <main className="relative z-10 space-y-3 sm:space-y-4 md:space-y-5 pb-6 sm:pb-8">
        <FigmaHero mode={mode} primaryHref={user ? '/account' : '/login'} />

        <div id="features">
          <CorePillarsOrganic />
        </div>

        <div id="docs">
          <AppsConsoleOrganic
            onExplore={() => setShowFullEcosystem((open) => !open)}
            onCardClick={handleConsoleCard}
          />
        </div>

        <AnimatePresence>
          {mode === 'dev' && activeConsoleCard === 'logs' ? (
            <motion.section
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mx-auto max-w-[1400px] overflow-hidden px-4 sm:px-6"
            >
              <AuthFlowTerminal />
            </motion.section>
          ) : null}
          {mode === 'dev' && activeConsoleCard === 'api' ? (
            <motion.section
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="mx-auto max-w-[1400px] px-4 sm:px-6"
            >
              <div className="rounded-2xl border border-border bg-card p-6 text-left shadow-sm">
                <h2 className="mb-2 flex items-center gap-2 font-heading text-sm font-bold text-foreground">
                  <Terminal className="size-4 text-emerald-500 dark:text-emerald-400" /> API Playground
                </h2>
                <p className="mb-4 text-xs text-muted-foreground">Copy your authorization endpoints to wire your SDK integrations.</p>
                <pre className="overflow-x-auto rounded-lg border border-border bg-muted/60 p-3 font-mono text-[11px] text-emerald-600 dark:bg-slate-900 dark:text-emerald-400">{`curl -X POST https://id.anand.dev/oauth/token \\\
  -d "grant_type=authorization_code" \\\
  -d "client_id=acme_app" \\\
  -d "code_challenge=PKCE_CHALLENGE"`}</pre>
              </div>
            </motion.section>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {showFullEcosystem ? (
            <motion.section
              id="ecosystem-panel"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden border-y border-border bg-muted/30"
            >
              <div className="mx-auto max-w-7xl px-6 py-12">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h2 className="font-heading text-lg font-bold text-foreground">App Ecosystem Consents</h2>
                    <p className="mt-1 text-xs text-muted-foreground">Review permissions and disconnect apps you no longer trust.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowFullEcosystem(false)}
                    aria-label="Close application ecosystem"
                    className="rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:bg-foreground hover:text-background"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <AppEcosystem user={user} onAppsChanged={setConnectedAppsCount} />
              </div>
            </motion.section>
          ) : null}
        </AnimatePresence>

        <MidValueBanner />

        <div id="security">
          <SecurityPrivacyOrganic />
        </div>

        <div id="blog">
          <FigmaTestimonials />
        </div>

        <div id="pricing">
          <CtaBannerOrganic onGetStarted={() => window.location.assign(user ? '/account' : '/login')} />
        </div>

        <FooterOrganic />
      </main>
    </div>
  );
}
