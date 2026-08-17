'use client';

import React from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, FileText, Circle, Sparkles } from 'lucide-react';
import { FigmaConnectedHub } from './FigmaConnectedHub';
import { MagneticButton } from '@/components/ui/gooey';

interface FigmaHeroProps {
  mode?: 'user' | 'dev';
  className?: string;
  primaryHref?: string;
  onGetStarted?: () => void;
  onViewDocs?: () => void;
}

const HERO_CONTENT = {
  user: {
    pill: 'One account • Every internal app',
    headline: (
      <>
        One account.
        <br />
        Every app.
        <br />
        You stay in
        <br />
        control.
      </>
    ),
    description:
      'Sign in once to your internal apps. Review what each app can access, manage active sessions, and revoke access whenever you need to.',
    primaryCta: 'Sign in',
    secondaryCta: {
      label: 'How It Works',
      href: '#features',
      icon: Sparkles,
    },
    badges: ['Single sign-on', 'Clear consent', 'Session control'],
  },
  dev: {
    pill: 'Self-hosted OpenID Connect • PKCE',
    headline: (
      <>
        One identity
        <br />
        layer for every
        <br />
        internal app.
      </>
    ),
    description:
      'Connect applications through standard OIDC discovery, Authorization Code with PKCE, RS256 ID tokens, and scope-aware userinfo.',
    primaryCta: 'Open console',
    secondaryCta: {
      label: 'View Docs',
      href: '#docs',
      icon: FileText,
    },
    badges: ['Self-hosted', 'OIDC standard', 'Admin managed'],
  },
};

/**
 * Hero — Figma node 1:4543 with fluid ambient dynamics and interactive USER / DEV modes.
 */
export function FigmaHero({
  mode = 'user',
  className = '',
  primaryHref = '/login',
  onGetStarted,
  onViewDocs,
}: FigmaHeroProps) {
  const content = HERO_CONTENT[mode] || HERO_CONTENT.user;
  const SecondaryIcon = content.secondaryCta.icon;

  return (
    <section className={`relative w-full px-3 py-4 sm:px-6 sm:py-6 lg:aspect-[941/418.6] lg:px-0 lg:py-0 ${className}`}>
      <div className="relative flex flex-col items-center gap-6 sm:gap-8 lg:contents">
        {/* LEFT: cream organic island */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="@container relative w-full max-w-[570px] lg:absolute lg:inset-y-0 lg:left-[2.497%] lg:max-w-none lg:w-[43.198%]"
        >
          <img
            src="/landing_components/hero.svg"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 size-full object-fill animate-island-breathe filter invert dark:filter-none transition-[filter] duration-300"
          />

          <div className="relative z-10 flex h-full flex-col items-start px-[12.67cqw] pt-[14.12cqw]">
            {/* Spec tag pill */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`pill-${mode}`}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="inline-flex w-fit select-none items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1.5 transition-transform duration-200 hover:scale-105 dark:border-black/10 dark:bg-black/5 lg:gap-[0.25cqw] lg:px-[1cqw] lg:py-[0.62cqw]"
              >
                <span className="size-1.5 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-900 lg:size-[0.9cqw]" />
                <span className="font-sans text-[10px] font-semibold leading-none tracking-wide text-zinc-100 dark:text-zinc-900 lg:text-[1.75cqw]">
                  {content.pill}
                </span>
              </motion.div>
            </AnimatePresence>

            {/* Headline */}
            <div className="mt-[6.52cqw] min-h-[30cqw] sm:min-h-[31cqw]">
              <AnimatePresence mode="wait">
                <motion.h1
                  key={`headline-${mode}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="font-heading text-[clamp(2rem,7.38cqw,2.65rem)] font-black leading-[1.12] tracking-tight text-zinc-50 dark:text-zinc-950 lg:text-[7.38cqw] lg:leading-[1.18]"
                >
                  {content.headline}
                </motion.h1>
              </AnimatePresence>
            </div>

            {/* Description */}
            <div className="mt-[2.85cqw] min-h-[8cqw]">
              <AnimatePresence mode="wait">
                <motion.p
                  key={`desc-${mode}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="max-w-[70cqw] text-[clamp(0.72rem,2.5cqw,0.9rem)] font-normal leading-relaxed text-zinc-300 dark:text-zinc-600 lg:max-w-[62.5cqw] lg:text-[2.5cqw]"
                >
                  {content.description}
                </motion.p>
              </AnimatePresence>
            </div>

            {/* Action buttons with magnetic spring physics */}
            <div className="mt-[2.87cqw] flex flex-wrap items-center gap-[3.15cqw]">
              <MagneticButton strength={0.22}>
                <Link href={primaryHref}>
                  <button
                    type="button"
                    onClick={onGetStarted}
                    className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-white px-3 font-semibold text-[11px] leading-none text-zinc-950 shadow-lg transition-all duration-150 hover:bg-zinc-100 active:scale-95 dark:bg-zinc-950 dark:text-white dark:hover:bg-zinc-800 lg:h-[8.12cqw] lg:gap-[1.1cqw] lg:px-[2.1cqw] lg:text-[2.2cqw]"
                  >
                    <span>{content.primaryCta}</span>
                    <span className="flex size-6 items-center justify-center rounded-full bg-black/10 text-black dark:bg-white/20 dark:text-white lg:size-[4.4cqw]">
                      <ArrowUpRight className="size-3.5 lg:size-[2.9cqw]" />
                    </span>
                  </button>
                </Link>
              </MagneticButton>

              <MagneticButton strength={0.18}>
                <a href={content.secondaryCta.href}>
                  <AnimatePresence mode="wait">
                    <motion.button
                      key={`cta-${mode}`}
                      type="button"
                      onClick={onViewDocs}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-full font-semibold text-[11px] leading-none text-zinc-200 transition-all duration-150 hover:text-white active:scale-95 dark:text-zinc-900 dark:hover:text-black lg:gap-[1.2cqw] lg:text-[2.2cqw]"
                    >
                      <span>{content.secondaryCta.label}</span>
                      <SecondaryIcon className="size-3.5 text-zinc-300 dark:text-zinc-700 lg:size-[2.4cqw]" />
                    </motion.button>
                  </AnimatePresence>
                </a>
              </MagneticButton>
            </div>

            {/* Spec footer row */}
            <div className="mt-6 flex flex-wrap items-center gap-3 text-[9px] font-semibold leading-none text-zinc-300 dark:text-zinc-700 lg:mt-[8.09cqw] lg:gap-[2.8cqw] lg:text-[1.6cqw]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`badges-${mode}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="flex flex-wrap items-center gap-3 lg:gap-[2.8cqw]"
                >
                  {content.badges.map((label) => (
                    <div key={label} className="flex items-center gap-1 transition-transform duration-200 hover:scale-105 lg:gap-[1cqw]">
                      <Circle className="size-3 shrink-0 stroke-[1.75] text-zinc-200 dark:text-zinc-900 lg:size-[2.46cqw]" />
                      <span>{label}</span>
                    </div>
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        {/* RIGHT: connected organic hub */}
        <div className="w-full lg:absolute lg:left-[43.263%] lg:top-[11.969%] lg:h-[83.132%] lg:w-[54.431%]">
          <FigmaConnectedHub mode={mode} />
        </div>
      </div>
    </section>
  );
}
