'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Shield, Zap, Lock, Code, Copy, Check, Terminal, ExternalLink } from 'lucide-react';
import type { User as UserType } from '@/types';
import { OAuthSimulator } from './OAuthSimulator';
import { ConsentSimulator } from './ConsentSimulator';

interface HeroSectionProps {
  user: UserType | null;
  connectedAppsCount: number;
  mode: 'user' | 'dev';
}

export function HeroSection({ user, mode }: HeroSectionProps) {
  const isDev = mode === 'dev';
  const [copiedDocker, setCopiedDocker] = useState(false);

  const copyDockerCommand = () => {
    navigator.clipboard.writeText('docker run -d -p 8080:8080 ghcr.io/oid/server:latest');
    setCopiedDocker(true);
    setTimeout(() => setCopiedDocker(false), 2000);
  };

  return (
    <section className="relative z-10 mx-auto grid max-w-7xl gap-8 lg:gap-12 px-6 py-10 md:py-16 lg:grid-cols-12 items-center">
      {/* LEFT COLUMN: Hero Heading, Value Proposition & Conversion Hub (6 cols on lg) */}
      <div className="lg:col-span-6 flex flex-col justify-stretch">
        <div className="bg-card text-card-foreground border border-border/80 rounded-3xl flex flex-col justify-between p-7 sm:p-10 lg:p-12 shadow-brutal-lg relative overflow-hidden transition-all duration-300">
          
          {/* Subtle decorative corner accent */}
          <div className="absolute top-0 right-0 size-32 bg-primary/5 rounded-bl-full pointer-events-none" />

          {/* Top content */}
          <div>
            {/* Dynamic Status / Spec Badge */}
            <div className="inline-flex items-center gap-2 border border-border bg-muted/50 px-3.5 py-1 rounded-full">
              <span className="size-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="eyebrow text-foreground/90 font-mono font-bold text-[10px] uppercase tracking-wider">
                {isDev ? 'RFC 6749 • OAuth 2.1 Strict • RS256' : 'Sovereign Identity • FIDO2 Passkeys'}
              </span>
            </div>
            
            {/* Animated Headline */}
            <h1 className="mt-6 font-heading text-3xl sm:text-5xl lg:text-[3.25rem] font-black leading-[1.08] tracking-tight text-foreground">
              <AnimatePresence mode="wait">
                {isDev ? (
                  <motion.div
                    key="dev-title"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.25 }}
                  >
                    One Identity Engine.
                    <br />
                    <span className="text-primary/90 underline decoration-border decoration-wavy underline-offset-4">
                      For Every App.
                    </span>
                  </motion.div>
                ) : (
                  <motion.div
                    key="user-title"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.25 }}
                  >
                    Your Identity.
                    <br />
                    <span className="text-primary/90 underline decoration-border decoration-wavy underline-offset-4">
                      Your Sovereign Way.
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </h1>

            {/* Description */}
            <p className="mt-5 max-w-md text-sm sm:text-[15px] text-muted-foreground leading-relaxed font-normal">
              <AnimatePresence mode="wait">
                {isDev ? (
                  <motion.span
                    key="dev-desc"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    Self-hosted, spec-compliant OpenID Connect provider built on OAuth 2.1, asymmetric RS256 signing, and instantaneous PKCE token exchanges.
                  </motion.span>
                ) : (
                  <motion.span
                    key="user-desc"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    Take complete ownership of your login credentials. Sign into third-party tools seamlessly while maintaining granular, 1-click control over your data.
                  </motion.span>
                )}
              </AnimatePresence>
            </p>
          </div>

          {/* Quickstart & Bottom actions */}
          <div className="mt-8 pt-4">
            {/* Primary & Secondary Action CTAs */}
            <div className="flex flex-wrap items-center gap-3.5 z-10">
              <Link href={user ? "/account" : "/login"}>
                <button className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-full font-heading text-xs font-bold tracking-wider uppercase transition-all duration-300 shadow-brutal-sm hover:scale-102 active:scale-98 cursor-pointer group">
                  {user ? "Go to Dashboard" : "Launch Self-Hosted"}
                  <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
                </button>
              </Link>
              <a href="#docs">
                <button className="flex items-center gap-2 px-5 py-3 border border-border bg-card hover:bg-muted/70 text-foreground rounded-full font-heading text-xs font-bold tracking-wider uppercase transition-all duration-300 cursor-pointer">
                  Explore Specs
                  <ExternalLink className="size-3.5 text-muted-foreground" />
                </button>
              </a>
            </div>

            {/* Inline Docker Quickstart Strip */}
            <div className="mt-6 flex items-center justify-between gap-2 p-2 px-3 bg-muted/40 border border-border/70 rounded-2xl">
              <div className="flex items-center gap-2 overflow-hidden text-[11px] font-mono text-muted-foreground">
                <Terminal className="size-3.5 text-foreground/70 shrink-0" />
                <span className="truncate text-foreground/90 font-medium select-all">
                  docker run -d -p 8080:8080 ghcr.io/oid/server
                </span>
              </div>
              <button
                onClick={copyDockerCommand}
                title="Copy Quickstart Command"
                className="flex items-center gap-1 text-[10px] font-mono px-2 py-1 bg-background hover:bg-muted text-foreground border border-border rounded-lg transition-all cursor-pointer shrink-0"
              >
                {copiedDocker ? (
                  <>
                    <Check className="size-3 text-emerald-500" />
                    <span className="text-emerald-500 font-bold">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-3 text-muted-foreground" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            {/* Proof Metric Chips */}
            <div className="mt-6 pt-5 border-t border-border/60 flex items-center justify-between flex-wrap gap-3 text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Lock className="size-3.5 text-foreground/80 shrink-0" />
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Zero Telemetry</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Zap className="size-3.5 text-foreground/80 shrink-0" />
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider">&lt;10ms Token Issue</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Code className="size-3.5 text-foreground/80 shrink-0" />
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider">100% Open Source</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Dynamic Interactive Product Simulator (6 cols on lg) */}
      <div className="lg:col-span-6 w-full flex items-center justify-center">
        <AnimatePresence mode="wait">
          {isDev ? (
            <motion.div
              key="oauth-sim"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.3 }}
              className="w-full"
            >
              <OAuthSimulator />
            </motion.div>
          ) : (
            <motion.div
              key="consent-sim"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.3 }}
              className="w-full"
            >
              <ConsentSimulator />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
