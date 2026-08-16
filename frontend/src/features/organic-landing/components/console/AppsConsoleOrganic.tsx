'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  LayoutGrid,
  Folder,
  CreditCard,
  Code,
  BookOpen,
  Users,
  Settings,
  List,
  ArrowUpRight,
} from 'lucide-react';
import { TiltCard, MagneticButton } from '@/components/ui/gooey';

export const CONSOLE_ITEMS = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    desc: 'Analytics and insights at a glance',
    icon: LayoutGrid,
  },
  {
    id: 'projects',
    title: 'Projects',
    desc: 'Manage and ship your projects',
    icon: Folder,
  },
  {
    id: 'billing',
    title: 'Billing',
    desc: 'Manage subscriptions and invoices',
    icon: CreditCard,
  },
  {
    id: 'api',
    title: 'API Console',
    desc: 'Test and explore our APIs',
    icon: Code,
  },
  {
    id: 'docs',
    title: 'Docs',
    desc: 'Guides and documentation',
    icon: BookOpen,
  },
  {
    id: 'users',
    title: 'Users',
    desc: 'Manage users and permissions',
    icon: Users,
  },
  {
    id: 'settings',
    title: 'Settings',
    desc: 'Configure OID to fit your needs',
    icon: Settings,
  },
  {
    id: 'logs',
    title: 'Logs',
    desc: 'Monitor and audit system logs',
    icon: List,
  },
];

interface AppsConsoleOrganicProps {
  onExplore?: () => void;
  onCardClick?: (id: string) => void;
}

export function AppsConsoleOrganic({ onExplore, onCardClick }: AppsConsoleOrganicProps) {
  return (
    <section className="relative mx-auto max-w-[1600px] px-2 sm:px-6 py-0">
      {/* 2nd Section Organic Island Container */}
      <motion.div
        initial={{ opacity: 0, y: 25 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full aspect-[910/293] min-h-[300px] md:min-h-[340px] flex items-center justify-center p-3 sm:p-5 md:p-6 lg:px-12 lg:py-2.5 select-none"
      >
        {/* Background SVG */}
        <img
          src="/landing_components/core_benifit.svg"
          alt=""
          className="absolute inset-0 w-full h-full object-fill pointer-events-none z-0 origin-center scale-[1.01] animate-island-breathe filter invert dark:filter-none drop-shadow-sm transition-[filter] duration-300"
          aria-hidden="true"
        />

        {/* Inner Content Grid */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-center w-full px-3 sm:px-6">
          {/* Left Column: Heading & Value Prop (4 cols) */}
          <div className="lg:col-span-4 space-y-2.5">
            <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-white/10 border border-white/15 dark:bg-black/5 dark:border-black/10 select-none w-fit transition-transform duration-200 hover:scale-105">
              <span className="text-[10.5px] sm:text-xs font-semibold text-zinc-100 dark:text-zinc-900">
                All in one access
              </span>
            </div>

            <h2 className="font-heading text-xl sm:text-2xl md:text-[2.2rem] lg:text-[2.4rem] font-black tracking-tight text-zinc-50 dark:text-zinc-950 leading-[1.04]">
              One account.
              <br />
              Access all your apps.
            </h2>

            <p className="text-xs sm:text-[13px] text-zinc-300 dark:text-zinc-600 font-normal leading-relaxed max-w-sm">
              Sign in once with OID and access all your tools and applications seamlessly.
            </p>

            <div className="pt-0.5">
              <MagneticButton strength={0.25}>
                <button
                  type="button"
                  onClick={onExplore}
                  className="cursor-pointer inline-flex items-center gap-2 px-4.5 sm:px-5 py-2 sm:py-2.5 rounded-full bg-white text-zinc-950 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-white dark:hover:bg-zinc-800 font-semibold text-xs sm:text-sm shadow-md transition-all duration-150 active:scale-95"
                >
                  <span>Explore all apps</span>
                  <ArrowUpRight className="size-3.5 sm:size-4" />
                </button>
              </MagneticButton>
            </div>
          </div>

          {/* Right Column: 2x4 Grid of App Console Cards with 3D Tilt (8 cols) */}
          <div className="lg:col-span-8">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: {
                    staggerChildren: 0.05,
                  },
                },
              }}
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-2.5"
            >
              {CONSOLE_ITEMS.map((item) => {
                const Icon = item.icon;

                return (
                  <motion.div
                    key={item.id}
                    variants={{
                      hidden: { opacity: 0, y: 12, scale: 0.96 },
                      visible: {
                        opacity: 1,
                        y: 0,
                        scale: 1,
                        transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
                      },
                    }}
                  >
                    <TiltCard
                      maxTilt={4.5}
                      onClick={() => onCardClick?.(item.id)}
                      className="p-3 sm:p-3.5 rounded-2xl bg-zinc-900/90 border border-zinc-800 hover:bg-zinc-800/90 dark:bg-white/90 dark:border-zinc-200/90 dark:hover:bg-white flex flex-col justify-between cursor-pointer hover:shadow-xl transition-all duration-200 group min-h-[110px] sm:min-h-[118px]"
                    >
                      <div>
                        <Icon className="size-4 sm:size-4.5 text-zinc-100 dark:text-zinc-950 mb-1.5 stroke-[1.75] transition-transform duration-200 group-hover:scale-115 group-hover:rotate-6" />
                        <h4 className="font-heading font-bold text-xs sm:text-[13px] text-zinc-50 dark:text-zinc-950">
                          {item.title}
                        </h4>
                        <p className="mt-0.5 text-[10.5px] sm:text-[11px] text-zinc-400 dark:text-zinc-500 font-normal leading-snug">
                          {item.desc}
                        </p>
                      </div>

                      <div className="mt-1.5 flex justify-end">
                        <div className="size-5 sm:size-5.5 rounded-full bg-white text-zinc-950 dark:bg-zinc-950 dark:text-white flex items-center justify-center group-hover:scale-120 transition-transform shadow-xs">
                          <ArrowUpRight className="size-2.5" />
                        </div>
                      </div>
                    </TiltCard>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
