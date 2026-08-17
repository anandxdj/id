'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Shield, EyeOff, User } from 'lucide-react';

export const VALUE_PROPS = [
  {
    icon: Zap,
    title: 'Authorization Code + PKCE',
    desc: 'S256 proof keys protect every authorization-code exchange.',
  },
  {
    icon: Shield,
    title: 'RS256 verification',
    desc: 'Applications verify ID tokens through published JWKS.',
  },
  {
    icon: EyeOff,
    title: 'Scope-aware claims',
    desc: 'Profile and email data are returned only when granted.',
  },
  {
    icon: User,
    title: 'Revocable access',
    desc: 'Users can disconnect apps and terminate active sessions.',
  },
];

export function MidValueBanner() {
  return (
    <section className="relative mx-auto max-w-[1600px] px-3 py-0 select-none sm:px-8">
      {/* Dark Organic Blob Island Container */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex min-h-0 w-full items-center justify-center px-5 py-9 select-none sm:px-7 sm:py-8 md:py-7 lg:aspect-[901/151] lg:min-h-[120px] lg:px-10 lg:py-2"
      >
        {/* Background SVG */}
        <img
          src="/landing_components/feature.svg"
          alt=""
          className="absolute inset-0 w-full h-full object-fill pointer-events-none z-0 scale-[1.02] animate-island-breathe filter invert dark:filter-none drop-shadow-sm transition-[filter] duration-300"
          aria-hidden="true"
        />

        {/* Inner Content Grid */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-center w-full px-3 sm:px-6">
          {/* Left Headline (4 cols) */}
          <div className="lg:col-span-4 space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-black/5 border border-black/10 text-zinc-800 dark:bg-white/10 dark:border-white/15 dark:text-zinc-200 text-[10.5px] font-semibold backdrop-blur-xs w-fit transition-transform duration-200 hover:scale-105">
              <span>Why ID</span>
            </div>

            <h2 className="font-heading text-xl sm:text-2xl md:text-[2rem] lg:text-[2.2rem] font-black tracking-tight text-zinc-950 dark:text-white leading-[1.05]">
              Built on standards.
              <br />
              Operated by you.
            </h2>
          </div>

          {/* Right 4-column Value Props with Stagger (8 cols) */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.08 },
              },
            }}
            className="grid grid-cols-2 gap-4 sm:gap-3 md:grid-cols-4 lg:col-span-8"
          >
            {VALUE_PROPS.map((item) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.title}
                  variants={{
                    hidden: { opacity: 0, y: 10 },
                    visible: {
                      opacity: 1,
                      y: 0,
                      transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
                    },
                  }}
                  whileHover={{
                    scale: 1.05,
                    y: -2,
                    transition: { type: 'spring', stiffness: 400, damping: 18 },
                  }}
                  className="space-y-1.5 cursor-pointer group"
                >
                  <div className="size-8 rounded-full bg-black/5 border border-black/10 text-zinc-900 dark:bg-white/10 dark:border-white/15 dark:text-white backdrop-blur-xs flex items-center justify-center shadow-xs transition-transform duration-200 group-hover:scale-115 group-hover:bg-black/10 dark:group-hover:bg-white/20">
                    <Icon className="size-3.5 stroke-[1.75]" />
                  </div>
                  <h4 className="font-heading font-bold text-xs text-zinc-950 dark:text-white">{item.title}</h4>
                  <p className="text-[10.5px] text-zinc-600 dark:text-zinc-400 leading-snug font-normal">{item.desc}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
