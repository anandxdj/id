'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Zap, Target, GitFork } from 'lucide-react';
import { ClayLock3D } from '../common/ClayLock3D';

export const SECURITY_FEATURES = [
  {
    icon: ShieldCheck,
    title: 'End-to-end security',
    desc: 'Best practices, always.',
  },
  {
    icon: Zap,
    title: 'Users own their data',
    desc: 'Export or delete anytime.',
  },
  {
    icon: Target,
    title: 'High availability',
    desc: '99.99% uptime and counting.',
  },
  {
    icon: GitFork,
    title: 'Open source',
    desc: 'Transparent and community driven.',
  },
];

export function SecurityPrivacyOrganic() {
  return (
    <section className="relative mx-auto max-w-[1400px] px-2 sm:px-6 py-0">
      {/* 3rd Section Organic Island Container */}
      <motion.div
        initial={{ opacity: 0, y: 25 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full aspect-[889/215] min-h-[250px] md:min-h-[280px] lg:min-h-[300px] flex items-center justify-center p-4 sm:p-5 md:p-6 lg:px-12 lg:py-2.5 select-none"
      >
        {/* Background SVG */}
        <img
          src="/landing_components/trust.svg"
          alt=""
          className="absolute inset-0 w-full h-full object-fill pointer-events-none z-0 scale-[1.01] animate-island-breathe filter invert dark:filter-none drop-shadow-sm transition-[filter] duration-300"
          aria-hidden="true"
        />

        {/* Inner Content: 3 Columns */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-center w-full px-3 sm:px-6">
          {/* Left Column: 3D Clay Lock Graphic */}
          <div className="lg:col-span-4 flex items-center justify-center">
            <ClayLock3D />
          </div>

          {/* Middle Column: Headline & Subtitle */}
          <div className="lg:col-span-4 space-y-2.5">
            <h2 className="font-heading text-xl sm:text-2xl md:text-3xl lg:text-[2.2rem] font-black tracking-tight text-zinc-50 dark:text-zinc-950 leading-[1.05]">
              Security. Privacy.
              <br />
              Performance.
            </h2>
            <p className="text-xs sm:text-[13px] text-zinc-300 dark:text-zinc-600 font-normal leading-relaxed max-w-sm">
              OID gives you all the tools you need to manage identity securely while giving users full control over their data.
            </p>
          </div>

          {/* Right Column: Security Feature Checklist */}
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
            className="lg:col-span-4 space-y-2 sm:space-y-2.5"
          >
            {SECURITY_FEATURES.map((item) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.title}
                  variants={{
                    hidden: { opacity: 0, x: 12 },
                    visible: {
                      opacity: 1,
                      x: 0,
                      transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
                    },
                  }}
                  whileHover={{
                    scale: 1.03,
                    x: 4,
                    transition: { type: 'spring', stiffness: 400, damping: 18 },
                  }}
                  className="flex items-center gap-3 select-none cursor-pointer group"
                >
                  <div className="size-7 sm:size-7.5 rounded-full border border-zinc-700 bg-zinc-800 text-zinc-100 dark:border-zinc-300 dark:bg-white/80 dark:text-zinc-950 flex items-center justify-center shrink-0 shadow-xs transition-transform duration-200 group-hover:scale-115 group-hover:bg-zinc-700 dark:group-hover:bg-white">
                    <Icon className="size-3.5 stroke-[1.75]" />
                  </div>
                  <div>
                    <h4 className="font-heading font-bold text-xs sm:text-[13px] text-zinc-50 dark:text-zinc-950 leading-tight">
                      {item.title}
                    </h4>
                    <p className="text-[10.5px] sm:text-[11px] text-zinc-400 dark:text-zinc-500 font-normal leading-tight mt-0.5">
                      {item.desc}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
