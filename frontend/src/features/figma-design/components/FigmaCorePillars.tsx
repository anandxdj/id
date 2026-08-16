'use client';

import React from 'react';
import { Lock, ShieldCheck, Code2, Sliders, LineChart } from 'lucide-react';

export const CORE_PILLARS_DATA = [
  {
    icon: Lock,
    title: 'Self-Hosted Freedom',
    desc: 'Host on your infrastructure and maintain full control.',
  },
  {
    icon: ShieldCheck,
    title: 'Enterprise Security',
    desc: 'Industry-best protection and regular auditing.',
  },
  {
    icon: Code2,
    title: 'Developer Friendly',
    desc: 'Client SDKs, clear APIs, and extensible hooks.',
  },
  {
    icon: Sliders,
    title: 'Highly Customizable',
    desc: 'Adapt flows, branding, and policies your way.',
  },
  {
    icon: LineChart,
    title: 'Built to Scale',
    desc: 'From startups to enterprise, we scale with you.',
  },
];

/**
 * Five core pillars — Figma node 1:4543.
 * Island bbox (20.3, 466.0, 900.3 x 150.3) → feature.svg (901 x 151).
 */
export function FigmaCorePillars({ className = '' }: { className?: string }) {
  return (
    <section
      className={`relative w-full px-4 py-6 sm:px-6 lg:aspect-[941/150.3] lg:px-0 lg:py-0 ${className}`}
    >
      <div className="@container relative w-full lg:absolute lg:inset-y-0 lg:left-[2.157%] lg:w-[95.674%]">
        <img
          src="/landing_components/feature.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 size-full object-fill filter invert dark:filter-none drop-shadow-sm transition-[filter] duration-300"
        />

        {/* Columns start at island-rel x 59.7 and repeat every 168.8 (18.75%);
            icon top 39, title cap 549, body cap 567 of the frame. */}
        <div className="relative z-10 grid h-full grid-cols-1 items-center gap-4 px-6 py-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 lg:items-start lg:gap-0 lg:py-0 lg:pl-[6.63cqw] lg:pr-0 lg:pt-[4.33cqw]">
          {CORE_PILLARS_DATA.map((pillar) => {
            const Icon = pillar.icon;

            return (
              <div
                key={pillar.title}
                className="group flex select-none flex-col items-start justify-start lg:pr-[6.86cqw]"
              >
                <Icon className="mb-[1.6cqw] size-5 stroke-[1.5] text-zinc-900 dark:text-white transition-transform duration-200 group-hover:scale-110 lg:mb-[1.578cqw] lg:size-[2.888cqw]" />
                <h4 className="font-heading text-xs font-bold leading-snug tracking-tight text-zinc-950 dark:text-white lg:text-[0.977cqw]">
                  {pillar.title}
                </h4>
                <p className="mt-0.5 text-[10px] font-normal leading-relaxed text-zinc-600 dark:text-zinc-400 lg:mt-[0.489cqw] lg:text-[0.878cqw] lg:leading-[1.85]">
                  {pillar.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
