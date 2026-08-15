'use client';

import React from 'react';
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
      <div className="relative w-full aspect-[889/215] min-h-[250px] md:min-h-[280px] lg:min-h-[300px] flex items-center justify-center p-4 sm:p-5 md:p-6 lg:px-12 lg:py-2.5 select-none">
        {/* Background SVG: trust.svg */}
        <img
          src="/landing_components/trust.svg"
          alt=""
          className="absolute inset-0 w-full h-full object-fill pointer-events-none z-0"
          aria-hidden="true"
        />

        {/* Inner Content: 3 Columns (Lock Graphic, Typography, Checklist) */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-center w-full px-3 sm:px-6">
          {/* Left Column: 3D Clay Lock Graphic (3.5 cols) */}
          <div className="lg:col-span-4 flex items-center justify-center">
            <ClayLock3D />
          </div>

          {/* Middle Column: Headline & Subtitle (4 cols) */}
          <div className="lg:col-span-4 space-y-2.5">
            <h2 className="font-heading text-xl sm:text-2xl md:text-3xl lg:text-[2.2rem] font-black tracking-tight text-zinc-950 leading-[1.05]">
              Security. Privacy.
              <br />
              Performance.
            </h2>
            <p className="text-xs sm:text-[13px] text-zinc-600 font-normal leading-relaxed max-w-sm">
              OID gives you all the tools you need to manage identity securely while giving users full control over their data.
            </p>
          </div>

          {/* Right Column: Security Feature Checklist (4.5 cols) */}
          <div className="lg:col-span-4 space-y-2 sm:space-y-2.5">
            {SECURITY_FEATURES.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex items-center gap-3 select-none">
                  <div className="size-7 sm:size-7.5 rounded-full border border-zinc-300 bg-white/70 flex items-center justify-center shrink-0 text-zinc-950 shadow-xs">
                    <Icon className="size-3.5 stroke-[1.75]" />
                  </div>
                  <div>
                    <h4 className="font-heading font-bold text-xs sm:text-[13px] text-zinc-950 leading-tight">
                      {item.title}
                    </h4>
                    <p className="text-[10.5px] sm:text-[11px] text-zinc-500 font-normal leading-tight mt-0.5">
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


