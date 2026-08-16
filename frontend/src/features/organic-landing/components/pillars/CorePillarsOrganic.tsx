'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Lock, ShieldCheck, Code2, Sliders, LineChart } from 'lucide-react';

export const CORE_PILLARS = [
  {
    icon: Lock,
    title: 'Self-Hosted Freedom',
    desc: 'Host on your infrastructure and maintain full control.',
  },
  {
    icon: ShieldCheck,
    title: 'Enterprise Security',
    desc: 'Industry best practices and regular updates.',
  },
  {
    icon: Code2,
    title: 'Developer Friendly',
    desc: 'Clear docs, SDKs, and extensible APIs.',
  },
  {
    icon: Sliders,
    title: 'Highly Customizable',
    desc: 'Adapt flows, branding, and policies your way.',
  },
  {
    icon: LineChart,
    title: 'Built to Scale',
    desc: 'From startups to enterprises, we scale with you.',
  },
];

interface CorePillarsOrganicProps {
  className?: string;
}

export function CorePillarsOrganic({
  className = '',
}: CorePillarsOrganicProps) {
  return (
    <section className={`relative mx-auto max-w-[1600px] px-4 sm:px-8 py-0 ${className}`}>
      {/* Dark Organic Blob Island Container */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full aspect-[901/151] min-h-[110px] md:min-h-[130px] flex items-center justify-center p-3 sm:p-4 md:p-5 lg:px-10 lg:py-2 select-none"
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
          className="relative z-10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 w-full px-3 sm:px-6 divide-y sm:divide-y-0 lg:divide-x divide-black/10 dark:divide-white/10"
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
                className="flex flex-col items-start justify-start p-2.5 sm:p-3 lg:px-5 select-none group cursor-pointer"
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
