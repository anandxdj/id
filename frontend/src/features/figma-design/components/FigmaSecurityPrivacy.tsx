'use client';

import React from 'react';
import { ShieldCheck, UserCheck, Activity, Code } from 'lucide-react';
import { FigmaClayLock } from './FigmaClayLock';

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

export function FigmaSecurityPrivacy() {
  return (
    <section className="relative mx-auto max-w-[1400px] px-2 sm:px-6 py-2">
      {/* 3rd Section Organic Island Container */}
      <div className="relative w-full aspect-[889/215] min-h-[260px] md:min-h-[290px] lg:min-h-[310px] flex items-center justify-center p-4 sm:p-6 md:p-8 lg:px-12 lg:py-4 select-none">
        {/* Background SVG: trust.svg */}
        <img
          src="/landing_components/trust.svg"
          alt=""
          className="absolute inset-0 w-full h-full object-fill pointer-events-none z-0"
          aria-hidden="true"
        />

        {/* Inner Content: 3 Columns (Lock Graphic, Typography, Checklist) */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-center w-full px-3 sm:px-6">
          {/* Left Column: 3D Clay Lock Graphic (3.5 cols) */}
          <div className="lg:col-span-4 flex items-center justify-center">
            <FigmaClayLock />
          </div>

          {/* Middle Column: Headline & Subtitle (4 cols) */}
          <div className="lg:col-span-4 space-y-2.5">
            <h2 className="font-heading text-xl sm:text-2xl md:text-3xl lg:text-[2.3rem] font-black tracking-tight text-zinc-950 leading-[1.05]">
              Security.
              <br />
              Privacy.
              <br />
              Performance.
            </h2>
            <p className="text-xs sm:text-[13px] text-zinc-600 font-normal leading-relaxed max-w-sm">
              OID is designed with security and privacy at its core. Zero compromises, engineered by developers, for teams.
            </p>
          </div>

          {/* Right Column: Security Feature Checklist (4.5 cols) */}
          <div className="lg:col-span-4 space-y-2.5 sm:space-y-3">
            {FIGMA_SECURITY_FEATURES.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex items-center gap-3 select-none">
                  <div className="size-7 sm:size-7.5 rounded-full border border-zinc-300 bg-white/80 flex items-center justify-center shrink-0 text-zinc-950 shadow-xs">
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
