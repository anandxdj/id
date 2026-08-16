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
    pill: 'Sovereign Identity • FIDO2 Passkeys',
    headline: (
      <>
        Your identity.
        <br />
        Your rules.
        <br />
        One login for
        <br />
        everything.
      </>
    ),
    description:
      'Take complete control of your login credentials. Seamlessly access connected apps with biometric passkeys while maintaining granular 1-click data consent.',
    secondaryCta: {
      label: 'How It Works',
      href: '#features',
      icon: Sparkles,
    },
    badges: ['Passwordless', 'Zero Tracking', 'Data Sovereignty'],
  },
  dev: {
    pill: 'OpenID Connect • Built for Scale',
    headline: (
      <>
        Authentication
        <br />
        done right.
        <br />
        OpenID Connect
        <br />
        made simple.
      </>
    ),
    description:
      'OID gives you a pure, standards-compliant identity platform to power SSO, manage users, and protect access—all for you to own.',
    secondaryCta: {
      label: 'View Docs',
      href: '#docs',
      icon: FileText,
    },
    badges: ['Self-Hosted', 'Open Standards', 'Zero Telemetry'],
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
    <section className={`relative w-full px-4 py-6 sm:px-6 lg:aspect-[941/418.6] lg:px-0 lg:py-0 ${className}`}>
      <div className="relative flex flex-col items-center gap-8 lg:contents">
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
                className="inline-flex w-fit select-none items-center gap-[0.25cqw] rounded-full border border-white/15 bg-white/10 dark:border-black/10 dark:bg-black/5 px-[1cqw] py-[0.62cqw] transition-transform duration-200 hover:scale-105"
              >
                <span className="size-[0.9cqw] rounded-full bg-zinc-100 dark:bg-zinc-900 animate-pulse" />
                <span className="font-sans text-[1.75cqw] font-semibold leading-none tracking-wide text-zinc-100 dark:text-zinc-900">
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
                  className="font-heading text-[7.38cqw] font-black leading-[1.18] tracking-tight text-zinc-50 dark:text-zinc-950"
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
                  className="max-w-[62.5cqw] text-[2.5cqw] font-normal leading-relaxed text-zinc-300 dark:text-zinc-600"
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
                    className="inline-flex h-[8.12cqw] cursor-pointer items-center gap-[1.1cqw] rounded-full bg-white text-zinc-950 shadow-md hover:bg-zinc-100 dark:bg-zinc-950 dark:text-white dark:hover:bg-zinc-800 px-[2.1cqw] font-semibold text-[2.2cqw] leading-none shadow-lg transition-all duration-150 active:scale-95"
                  >
                    <span>Get Started</span>
                    <span className="flex size-[4.4cqw] items-center justify-center rounded-full bg-black/10 text-black dark:bg-white/20 dark:text-white">
                      <ArrowUpRight className="size-[2.9cqw]" />
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
                      className="inline-flex cursor-pointer items-center gap-[1.2cqw] rounded-full font-semibold text-[2.2cqw] leading-none text-zinc-200 hover:text-white dark:text-zinc-900 dark:hover:text-black transition-all duration-150 active:scale-95"
                    >
                      <span>{content.secondaryCta.label}</span>
                      <SecondaryIcon className="size-[2.4cqw] text-zinc-300 dark:text-zinc-700" />
                    </motion.button>
                  </AnimatePresence>
                </a>
              </MagneticButton>
            </div>

            {/* Spec footer row */}
            <div className="mt-[8.09cqw] flex flex-wrap items-center gap-[2.8cqw] text-[1.6cqw] font-semibold leading-none text-zinc-300 dark:text-zinc-700">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`badges-${mode}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="flex flex-wrap items-center gap-[2.8cqw]"
                >
                  {content.badges.map((label) => (
                    <div key={label} className="flex items-center gap-[1cqw] transition-transform duration-200 hover:scale-105">
                      <Circle className="size-[2.46cqw] shrink-0 stroke-[1.75] text-zinc-200 dark:text-zinc-900" />
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
