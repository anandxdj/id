'use client';

import React from 'react';
import { ShieldCheck, UserCheck, Activity, Code } from 'lucide-react';

export const FIGMA_SECURITY_FEATURES = [
  {
    icon: ShieldCheck,
    title: 'End-to-end encryption',
    desc: 'Protect data at rest and in transit.',
  },
  {
    icon: UserCheck,
    title: 'User privacy by design',
    desc: 'GDPR, CCPA, and HIPAA compliant core.',
  },
  {
    icon: Activity,
    title: 'Global High Availability',
    desc: '99.99% uptime with redundant infrastructure.',
  },
  {
    icon: Code,
    title: 'Open Source',
    desc: 'Transparent codebase and continuous audits.',
  },
];

/**
 * Security / privacy / performance — Figma node 1:4543.
 * Island bbox (12.0, 1032.0, 888.3 x 214.3) → trust.svg (889 x 215).
 * Lock art bbox (91.7, 1106.9, 170.5 x 110.0) → lock.svg, a flat padlock over
 * a grey puddle (replaces the former 3D clay cushion).
 */
export function FigmaSecurityPrivacy({ className = '' }: { className?: string }) {
  return (
    <section
      className={`relative w-full px-4 py-6 sm:px-6 lg:aspect-[941/214.3] lg:px-0 lg:py-0 ${className}`}
    >
      <div className="@container relative w-full lg:absolute lg:inset-y-0 lg:left-[1.275%] lg:w-[94.399%]">
        <img
          src="/landing_components/trust.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 size-full object-fill filter invert dark:filter-none drop-shadow-sm transition-[filter] duration-300"
        />

        <div className="relative z-10 grid h-full grid-cols-1 items-center gap-6 px-6 py-10 lg:grid-cols-12 lg:gap-0 lg:px-0 lg:py-0">
          {/* Left: flat lock illustration, bbox 8.97% .. 28.16% of the island */}
          <div className="flex items-center justify-center lg:col-span-4 lg:justify-start lg:pl-[8.97cqw]">
            <img
              src="/landing_components/lock.svg"
              alt=""
              aria-hidden="true"
              className="pointer-events-none w-40 max-w-none object-contain sm:w-48 lg:w-[19.2cqw] filter invert dark:filter-none drop-shadow-sm"
            />
          </div>

          {/* Middle: headline & subtitle */}
          <div className="space-y-2.5 lg:col-span-4 lg:space-y-[1.4cqw] lg:pl-[3.5cqw]">
            <h2 className="font-heading text-2xl font-black leading-[1.05] tracking-tight text-zinc-50 dark:text-zinc-950 lg:text-[3.1cqw]">
              Security.
              <br />
              Privacy.
              <br />
              Performance.
            </h2>
            <p className="max-w-sm text-xs font-normal leading-relaxed text-zinc-300 dark:text-zinc-600 lg:max-w-none lg:text-[1.25cqw]">
              OID is designed with security and privacy at its core. Zero compromises, engineered by developers, for teams.
            </p>
          </div>

          {/* Right: security checklist, x-cluster 67.0% .. 90.1% of the island */}
          <div className="space-y-3 lg:col-span-4 lg:space-y-[1.6cqw] lg:pl-[7cqw]">
            {FIGMA_SECURITY_FEATURES.map((item) => {
              const Icon = item.icon;

              return (
                <div key={item.title} className="flex select-none items-center gap-3 lg:gap-[1.2cqw]">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-zinc-100 dark:border-zinc-300 dark:bg-white/80 dark:text-zinc-950 shadow-xs lg:size-[2.6cqw]">
                    <Icon className="size-3.5 stroke-[1.75] lg:size-[1.3cqw]" />
                  </div>
                  <div>
                    <h4 className="font-heading text-xs font-bold leading-tight text-zinc-50 dark:text-zinc-950 lg:text-[1.35cqw]">
                      {item.title}
                    </h4>
                    <p className="mt-0.5 text-[10.5px] font-normal leading-tight text-zinc-400 dark:text-zinc-500 lg:mt-[0.25cqw] lg:text-[1.1cqw]">
                      {item.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
