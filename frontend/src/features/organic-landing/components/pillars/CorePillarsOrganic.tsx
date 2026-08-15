'use client';

import React from 'react';
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
      <div className="relative w-full aspect-[902/168] min-h-[110px] md:min-h-[130px] flex items-center justify-center p-3 sm:p-4 md:p-5 lg:px-10 lg:py-2 select-none">
        {/* Background SVG: socialproff.svg */}
        <img
          src="/landing_components/socialproff.svg"
          alt=""
          className="absolute inset-0 w-full h-full object-fill pointer-events-none z-0"
          aria-hidden="true"
        />

        {/* Inner 5-Pillar Grid Layer with Vertical Dividers */}
        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 w-full px-3 sm:px-6 divide-y sm:divide-y-0 lg:divide-x divide-white/10">
          {CORE_PILLARS.map((pillar) => {
            const Icon = pillar.icon;

            return (
              <div
                key={pillar.title}
                className="flex flex-col items-start justify-start p-2.5 sm:p-3 lg:px-5 select-none group"
              >
                <div className="mb-2 text-white transition-transform duration-200 group-hover:scale-110">
                  <Icon className="size-5 stroke-[1.5]" />
                </div>
                <h4 className="font-heading font-bold text-xs sm:text-[12.5px] text-white tracking-tight leading-snug">
                  {pillar.title}
                </h4>
                <p className="mt-0.5 text-[10px] sm:text-[10.5px] text-zinc-400 font-normal leading-relaxed">
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

