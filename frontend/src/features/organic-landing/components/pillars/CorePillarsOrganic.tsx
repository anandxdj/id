'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Lock, ShieldCheck, Code2, Sliders, LineChart } from 'lucide-react';

export const CORE_PILLARS = [
  {
    icon: Lock,
    title: 'Self-hosted control',
    desc: 'Run identity on infrastructure and databases you operate.',
  },
  {
    icon: ShieldCheck,
    title: 'Standards-based SSO',
    desc: 'Use OpenID Connect, PKCE, discovery, and signed ID tokens.',
  },
  {
    icon: Code2,
    title: 'Centralized access',
    desc: 'Give every internal app one place to authenticate users.',
  },
  {
    icon: Sliders,
    title: 'Consent by design',
    desc: 'Share profile and email claims only after user approval.',
  },
  {
    icon: LineChart,
    title: 'Operator controls',
    desc: 'Manage users, OAuth clients, sessions, and activity centrally.',
  },
];

interface CorePillarsOrganicProps {
  className?: string;
}

export function CorePillarsOrganic({
  className = '',
}: CorePillarsOrganicProps) {
  return (
    <section className={`relative mx-auto max-w-[1600px] px-3 py-0 sm:px-8 ${className}`}>
      {/* Dark Organic Blob Island Container */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex min-h-0 w-full items-center justify-center px-4 py-9 select-none sm:px-6 sm:py-8 md:py-6 lg:aspect-[901/151] lg:min-h-[130px] lg:px-10 lg:py-2"
      >
        {/* Background SVG */}
        <img
          src="/landing_components/feature.svg"
          alt=""
          className="absolute inset-0 w-full h-full object-fill pointer-events-none z-0 scale-[1.01] animate-island-breathe filter invert dark:filter-none drop-shadow-sm transition-[filter] duration-300"
          aria-hidden="true"
        />

        {/* Inner 5-Pillar Grid Layer */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: {
                staggerChildren: 0.08,
              },
            },
          }}
          className="relative z-10 grid w-full grid-cols-2 divide-black/10 px-1 dark:divide-white/10 sm:px-6 md:grid-cols-3 lg:grid-cols-5 lg:divide-x"
        >
          {CORE_PILLARS.map((pillar) => {
            const Icon = pillar.icon;

            return (
              <motion.div
                key={pillar.title}
                variants={{
                  hidden: { opacity: 0, y: 12 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
                  },
                }}
                whileHover={{
                  scale: 1.03,
                  y: -2,
                  transition: { type: 'spring', stiffness: 400, damping: 18 },
                }}
                className="group flex cursor-pointer select-none flex-col items-start justify-start border-b border-black/10 p-3 dark:border-white/10 even:border-l last:col-span-2 last:border-b-0 last:border-l-0 last:items-center last:text-center sm:last:col-span-1 sm:last:items-start sm:last:text-left md:[&:nth-child(4)]:border-b-0 lg:border-b-0 lg:border-l-0 lg:px-5"
              >
                <div className="mb-2 text-zinc-900 dark:text-white transition-transform duration-200 group-hover:scale-115 group-hover:rotate-6">
                  <Icon className="size-5 stroke-[1.5]" />
                </div>
                <h4 className="font-heading font-bold text-xs sm:text-[12.5px] text-zinc-950 dark:text-white tracking-tight leading-snug">
                  {pillar.title}
                </h4>
                <p className="mt-0.5 text-[10px] sm:text-[10.5px] text-zinc-600 dark:text-zinc-400 font-normal leading-relaxed">
                  {pillar.desc}
                </p>
              </motion.div>
            );
          })}
        </motion.div>
      </motion.div>
    </section>
  );
}
