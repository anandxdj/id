'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Zap,
  Box,
  User,
  Database,
  ShieldCheck,
  Unlock,
  UserCheck,
  Lock,
} from 'lucide-react';

interface HubCardSlot {
  id: string;
  art: string;
  box: string;
  floatClass: string;
  delay: number;
  user: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    desc: string;
  };
  dev: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    desc: string;
  };
}

/**
 * Flat vector hub extracted from Figma node 1:4543 with zero-gravity floating dynamics.
 */
const HUB_SLOTS: HubCardSlot[] = [
  {
    id: 'tl',
    art: '/landing_components/hub_card_tl.svg',
    box: 'lg:left-[6.736%] lg:top-0 lg:w-[28.173%] lg:h-[20.632%]',
    floatClass: 'animate-float-sine-1',
    delay: 0,
    user: {
      icon: ShieldCheck,
      title: 'Passkey Protected',
      desc: 'FIDO2 biometric sign-in without passwords.',
    },
    dev: {
      icon: Shield,
      title: 'Secure',
      desc: 'Enterprise-grade RS256 & PKCE encryption.',
    },
  },
  {
    id: 'tr',
    art: '/landing_components/hub_card_tr.svg',
    box: 'lg:left-[73.194%] lg:top-[2.069%] lg:w-[24.834%] lg:h-[19.971%]',
    floatClass: 'animate-float-sine-2',
    delay: 0.1,
    user: {
      icon: Zap,
      title: '1-Click Sign-In',
      desc: 'Instant, seamless access across all apps.',
    },
    dev: {
      icon: Zap,
      title: 'Fast',
      desc: 'Sub-10ms token issuance & high throughput.',
    },
  },
  {
    id: 'bl',
    art: '/landing_components/hub_card_bl.svg',
    box: 'lg:left-0 lg:top-[62.874%] lg:w-[28.192%] lg:h-[20.920%]',
    floatClass: 'animate-float-sine-3',
    delay: 0.2,
    user: {
      icon: Unlock,
      title: 'No Lock-In',
      desc: 'Take your identity anywhere freely.',
    },
    dev: {
      icon: Box,
      title: 'Open Standards',
      desc: 'Full OpenID Connect & OAuth 2.1 compliance.',
    },
  },
  {
    id: 'br',
    art: '/landing_components/hub_card_br.svg',
    box: 'lg:left-[74.034%] lg:top-[62.787%] lg:w-[25.947%] lg:h-[23.592%]',
    floatClass: 'animate-float-sine-1',
    delay: 0.15,
    user: {
      icon: UserCheck,
      title: 'Granular Consent',
      desc: 'Revoke app permissions anytime in 1 click.',
    },
    dev: {
      icon: User,
      title: 'User Data Ownership',
      desc: 'Self-hosted with zero external telemetry.',
    },
  },
  {
    id: 'bc',
    art: '/landing_components/hub_card_bc.svg',
    box: 'lg:left-[31.199%] lg:top-[79.799%] lg:w-[25.810%] lg:h-[20.172%]',
    floatClass: 'animate-float-sine-2',
    delay: 0.25,
    user: {
      icon: Lock,
      title: 'Always Secure',
      desc: 'End-to-end encrypted identity safeguards.',
    },
    dev: {
      icon: Database,
      title: 'Reliable',
      desc: 'Built to scale stateless session architecture.',
    },
  },
];

/** Central blob + cast shadow + concentric OID badge with fluid breathing. */
function HubCore({ className = '' }: { className?: string }) {
  return (
    <div className={`@container relative ${className}`}>
      <img
        src="/landing_components/hub_shadow.svg"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute left-[34.420%] top-[60.891%] z-0 h-[13.563%] w-[36.294%] object-fill opacity-80"
      />
      <motion.img
        src="/landing_components/hub_blob.svg"
        alt=""
        aria-hidden="true"
        animate={{
          scale: [1, 1.02, 1],
          rotate: [0, 0.6, -0.6, 0],
        }}
        transition={{
          duration: 9,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="pointer-events-none absolute left-[29.305%] top-[1.839%] z-10 h-[72.615%] w-[44.045%] object-fill"
      />
      <motion.div
        whileHover={{ scale: 1.12 }}
        transition={{ type: 'spring', stiffness: 400, damping: 18 }}
        className="absolute left-[39.613%] top-[34.138%] z-20 flex h-[28.190%] w-[19.133%] cursor-pointer items-center justify-center rounded-full bg-foreground shadow-lg shadow-black/20"
      >
        <span className="font-heading text-[4.8cqw] font-black leading-none tracking-tight text-background select-none">
          OID
        </span>
      </motion.div>
    </div>
  );
}

interface FigmaConnectedHubProps {
  mode?: 'user' | 'dev';
}

export function FigmaConnectedHub({ mode = 'user' }: FigmaConnectedHubProps) {
  return (
    <div className="relative w-full select-none lg:h-full">
      {/* Decorative core */}
      <HubCore className="mx-auto mb-4 aspect-[512/348] w-full max-w-[420px] lg:absolute lg:inset-0 lg:m-0 lg:aspect-auto lg:max-w-none lg:size-full" />

      {/* 5 zero-gravity floating satellite cards */}
      <div className="relative z-20 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:contents">
        {HUB_SLOTS.map((slot) => {
          const cardData = slot[mode] || slot.user;
          const Icon = cardData.icon;

          return (
            <motion.div
              key={slot.id}
              initial={{ opacity: 0, y: 15, scale: 0.96 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{
                duration: 0.6,
                delay: slot.delay,
                ease: [0.16, 1, 0.3, 1],
              }}
              className={`@container group relative cursor-pointer lg:absolute ${slot.box}`}
            >
              <motion.div
                whileHover={{
                  scale: 1.045,
                  y: -3,
                  transition: { type: 'spring', stiffness: 400, damping: 20 },
                }}
                whileTap={{ scale: 0.97 }}
                className={`relative size-full ${slot.floatClass}`}
              >
                <img
                  src={slot.art}
                  alt=""
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 size-full object-fill drop-shadow-sm transition-all duration-300 group-hover:drop-shadow-md filter invert dark:filter-none"
                />

                <div className="relative z-10 size-full">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`${mode}-${slot.id}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                      className="flex h-full items-center gap-[5cqw] px-[6cqw] py-[7cqw]"
                    >
                      <div className="flex size-[9cqw] shrink-0 items-center justify-center rounded-full bg-white/10 dark:bg-black/5 transition-transform duration-200 group-hover:scale-110 group-hover:bg-white/20 dark:group-hover:bg-black/10">
                        <Icon className="size-[5.5cqw] stroke-[1.8] text-zinc-100 dark:text-zinc-950" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-heading text-[5.4cqw] font-bold leading-tight text-zinc-50 dark:text-zinc-950">
                          {cardData.title}
                        </p>
                        <p className="mt-[1cqw] text-[4.5cqw] font-normal leading-snug text-zinc-300 dark:text-zinc-600">
                          {cardData.desc}
                        </p>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </motion.div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
