'use client';

import React from 'react';
import { Zap, Shield, Cpu, Users } from 'lucide-react';

export const FIGMA_VALUE_PROPS = [
  {
    icon: Zap,
    title: 'Blazing Fast',
    desc: 'Low-latency authentication that keeps users happy.',
  },
  {
    icon: Shield,
    title: 'Standards First',
    desc: 'Built on OpenID Connect and OAuth 2.1.',
  },
  {
    icon: Cpu,
    title: 'Extensible',
    desc: 'Hooks, webhooks, and custom claims.',
  },
  {
    icon: Users,
    title: 'Community Driven',
    desc: 'Open source transparent, and community focused.',
  },
];

/**
 * Mid value banner — Figma node 1:4543.
 * Island bbox (19.5, 918.4, 903.4 x 113.7) → corebenifit.svg (904 x 114).
 */
export function FigmaMidBanner({ className = '' }: { className?: string }) {
  return (
    <section
      className={`relative w-full select-none px-4 py-6 sm:px-6 lg:aspect-[941/113.7] lg:px-0 lg:py-0 ${className}`}
    >
      <div className="@container relative w-full lg:absolute lg:inset-y-0 lg:left-[2.072%] lg:w-[95.998%]">
        <img
          src="/landing_components/corebenifit.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 size-full object-fill filter invert dark:filter-none drop-shadow-sm transition-[filter] duration-300"
        />

        <div className="relative z-10 grid h-full grid-cols-1 items-center gap-6 px-6 py-8 lg:grid-cols-12 lg:gap-[2cqw] lg:px-[4.5cqw] lg:py-0">
          {/* Left headline */}
          <div className="space-y-2 lg:col-span-4 lg:space-y-[1.2cqw]">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-black/10 bg-black/5 dark:border-white/15 dark:bg-white/10 px-3 py-0.5 text-[10.5px] font-semibold text-zinc-800 dark:text-zinc-200 backdrop-blur-xs lg:gap-[0.6cqw] lg:px-[1.1cqw] lg:py-[0.2cqw] lg:text-[1.15cqw]">
              <span className="size-1.5 rounded-full bg-zinc-900 dark:bg-white lg:size-[0.5cqw]" />
              <span>Why developers choose OID</span>
            </div>

            <h2 className="font-heading text-2xl font-black leading-[1.05] tracking-tight text-zinc-950 dark:text-white lg:text-[2.9cqw]">
              Built by developers.
              <br />
              Trusted by teams
            </h2>
          </div>

          {/* Right 4-column value props */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 lg:col-span-8 lg:gap-[2cqw]">
            {FIGMA_VALUE_PROPS.map((item) => {
              const Icon = item.icon;

              return (
                <div key={item.title} className="space-y-1.5 lg:space-y-[0.6cqw]">
                  <div className="flex size-8 items-center justify-center rounded-full border border-black/10 bg-black/5 text-zinc-900 dark:border-white/15 dark:bg-white/10 dark:text-white shadow-xs backdrop-blur-xs lg:size-[2.9cqw]">
                    <Icon className="size-3.5 stroke-[1.75] lg:size-[1.4cqw]" />
                  </div>
                  <h4 className="font-heading text-xs font-bold text-zinc-950 dark:text-white lg:text-[1.35cqw]">
                    {item.title}
                  </h4>
                  <p className="text-[10.5px] font-normal leading-snug text-zinc-600 dark:text-zinc-400 lg:text-[1.1cqw]">
                    {item.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
