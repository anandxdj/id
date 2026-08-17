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
  Fingerprint,
  KeyRound,
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
      title: 'Secure sign-in',
      desc: 'Use your password or an enabled social provider.',
    },
    dev: {
      icon: Shield,
      title: 'Signed tokens',
      desc: 'RS256 ID tokens with published verification keys.',
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
      title: 'One session',
      desc: 'Move between connected apps without signing in again.',
    },
    dev: {
      icon: Zap,
      title: 'PKCE flow',
      desc: 'Authorization Code with S256 proof key validation.',
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
      title: 'App access',
      desc: 'See and revoke every application you have authorized.',
    },
    dev: {
      icon: Box,
      title: 'OpenID discovery',
      desc: 'Standard metadata, JWKS, token, and userinfo endpoints.',
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
      title: 'Scoped consent',
      desc: 'Approve profile and email access before data is shared.',
    },
    dev: {
      icon: User,
      title: 'Scoped claims',
      desc: 'Return only the profile claims an application requested.',
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
      title: 'Session control',
      desc: 'Review devices and sign out sessions you do not recognize.',
    },
    dev: {
      icon: Database,
      title: 'Self-hosted state',
      desc: 'Keep users in MongoDB and live sessions in Redis.',
    },
  },
];

/** 3D Volumetric Fluid Organic Blob Hub with ID Emblem */
function HubCore({ className = '' }: { className?: string }) {
  return (
    <div className={`@container relative select-none ${className}`}>
      {/* Soft Ambient Radial Floor Shadow */}
      <div 
        className="pointer-events-none absolute left-[32%] top-[56%] h-[24%] w-[38%] rounded-full bg-black/25 dark:bg-black/80 blur-2xl -z-10"
        aria-hidden="true"
      />

      {/* 3D Volumetric Fluid Organic Blob with Levitation */}
      <motion.div
        animate={{
          scale: [1, 1.025, 1],
          rotate: [0, 0.7, -0.7, 0],
          y: [-4, 4, -4],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="pointer-events-none absolute left-[29.305%] top-[1.839%] z-10 h-[72.615%] w-[44.045%]"
      >
        <img
          src="/landing_components/hub_blob.svg"
          alt=""
          aria-hidden="true"
          className="size-full object-fill drop-shadow-[0_18px_35px_rgba(0,0,0,0.14)] dark:drop-shadow-[0_20px_40px_rgba(0,0,0,0.6)]"
        />
      </motion.div>

      {/* Central 3D Embossed ID Core Badge */}
      <motion.div
        whileHover={{ scale: 1.12 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 400, damping: 16 }}
        className="absolute left-[39.613%] top-[34.138%] z-20 flex h-[28.190%] w-[19.133%] cursor-pointer items-center justify-center rounded-full bg-foreground shadow-xl shadow-black/25 border border-white/10"
      >
        <span className="font-heading text-[4.8cqw] font-black leading-none tracking-tight text-background select-none">
          ID
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
      <div className="relative z-20 grid grid-cols-2 gap-2.5 sm:gap-3 lg:contents">
        {HUB_SLOTS.map((slot) => {
          const cardData = slot[mode] || slot.user;
          const Icon = cardData.icon;

          return (
            <motion.div
              key={slot.id}
              initial={{ opacity: 0, y: 15, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                duration: 0.6,
                delay: slot.delay,
                ease: [0.16, 1, 0.3, 1],
              }}
              className={`@container group relative min-h-28 cursor-pointer last:col-span-2 sm:last:col-span-1 lg:absolute lg:min-h-0 ${slot.box}`}
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
                      className="flex h-full items-center gap-2.5 px-3 py-4 lg:gap-[5cqw] lg:px-[6cqw] lg:py-[7cqw]"
                    >
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/10 transition-transform duration-200 group-hover:scale-110 group-hover:bg-white/20 dark:bg-black/5 dark:group-hover:bg-black/10 lg:size-[9cqw]">
                        <Icon className="size-3.5 stroke-[1.8] text-zinc-100 dark:text-zinc-950 lg:size-[5.5cqw]" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-heading text-[11px] font-bold leading-tight text-zinc-50 dark:text-zinc-950 sm:text-xs lg:text-[5.4cqw]">
                          {cardData.title}
                        </p>
                        <p className="mt-1 text-[9px] font-normal leading-snug text-zinc-300 dark:text-zinc-600 sm:text-[10px] lg:mt-[1cqw] lg:text-[4.5cqw]">
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
