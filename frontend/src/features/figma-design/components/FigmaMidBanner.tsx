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

export function FigmaMidBanner() {
  return (
    <section className="relative mx-auto max-w-[1600px] px-4 sm:px-8 py-2 select-none">
      {/* Dark Organic Blob Island Container */}
      <div className="relative w-full aspect-[901/151] min-h-[110px] md:min-h-[130px] flex items-center justify-center p-3 sm:p-4 md:p-5 lg:px-10 lg:py-2 select-none">
        {/* Background SVG: feature.svg */}
        <img
          src="/landing_components/feature.svg"
          alt=""
          className="absolute inset-0 w-full h-full object-fill pointer-events-none z-0 scale-[1.02]"
          aria-hidden="true"
        />

        {/* Inner Content Grid */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-center w-full px-3 sm:px-6">
          {/* Left Headline (4 cols) */}
          <div className="lg:col-span-4 space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-white/10 border border-white/15 text-zinc-200 text-[10.5px] font-semibold backdrop-blur-xs w-fit">
              <span className="size-1.5 rounded-full bg-white" />
              <span>Why developers choose OID</span>
            </div>

            <h2 className="font-heading text-xl sm:text-2xl md:text-[2rem] lg:text-[2.3rem] font-black tracking-tight text-white leading-[1.05]">
              Built by developers.
              <br />
              Trusted by teams
            </h2>
          </div>

          {/* Right 4-column Value Props (8 cols) */}
          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-3.5">
            {FIGMA_VALUE_PROPS.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="space-y-1.5">
                  <div className="size-8 rounded-full bg-white/10 border border-white/15 backdrop-blur-xs flex items-center justify-center text-white shadow-xs">
                    <Icon className="size-3.5 stroke-[1.75]" />
                  </div>
                  <h4 className="font-heading font-bold text-xs sm:text-[13px] text-white">{item.title}</h4>
                  <p className="text-[10.5px] text-zinc-400 leading-snug font-normal">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
