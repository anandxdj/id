'use client';

import React from 'react';
import { ArrowUpRight, Lock, Zap, Code } from 'lucide-react';

interface HeroVariantConnectedHubProps {
  onGetStarted?: () => void;
  onViewDocs?: () => void;
  onBookDemo?: () => void;
}

export function HeroVariantConnectedHub({
  onGetStarted,
  onViewDocs,
  onBookDemo,
}: HeroVariantConnectedHubProps) {
  return (
    <section className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-0">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 xl:gap-8 items-center">
        {/* LEFT COLUMN: Organic Blob Card */}
        <div className="lg:col-span-6 flex justify-center lg:justify-end">
          <div className="relative w-full max-w-[570px] aspect-[407/419] flex items-center justify-center p-5 sm:p-7 md:p-8 lg:p-9 select-none">
            {/* Background SVG: hero.svg */}
            <img
              src="/landing_components/hero.svg"
              alt=""
              className="absolute inset-0 w-full h-full object-fill pointer-events-none z-0 scale-[1.02] origin-center"
              aria-hidden="true"
            />

            {/* Inner Content Layer */}
            <div className="relative z-10 w-full max-w-[440px] flex flex-col justify-center space-y-3.5 sm:space-y-4 px-2 sm:px-5 py-1.5">
              {/* Spec Tag Pill */}
              <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-black/5 border border-black/10 select-none w-fit">
                <span className="size-2 rounded-full bg-zinc-950" />
                <span className="text-[11px] sm:text-xs font-semibold tracking-wide text-zinc-900 font-sans">
                  OpenID Connect Provider
                </span>
              </div>

              {/* Headline */}
              <h1 className="font-heading text-2xl sm:text-3xl md:text-[2.5rem] lg:text-[2.9rem] font-black tracking-tight text-zinc-950 leading-[1.04]">
                Your Identity.
                <br />
                Your Way.
              </h1>

              {/* Description */}
              <p className="text-xs sm:text-[13.5px] md:text-[14px] text-zinc-600 font-normal leading-relaxed max-w-[400px]">
                OID is a self-hosted OpenID Connect provider that&apos;s secure, fast, and built for you to own your identity and access everything seamlessly.
              </p>

              {/* Action Buttons */}
              <div className="pt-0.5 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={onGetStarted}
                  className="cursor-pointer inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 rounded-full bg-zinc-950 text-white font-semibold text-xs sm:text-sm shadow-lg hover:bg-zinc-800 hover:scale-105 active:scale-95 transition-all duration-150"
                >
                  <span>Get Started</span>
                  <ArrowUpRight className="size-4" />
                </button>

                <button
                  type="button"
                  onClick={onViewDocs || onBookDemo}
                  className="cursor-pointer inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 rounded-full bg-white/80 text-zinc-950 font-semibold text-xs sm:text-sm border border-zinc-300/90 hover:bg-white hover:scale-105 active:scale-95 transition-all duration-150"
                >
                  <span>View Docs</span>
                  <ArrowUpRight className="size-4" />
                </button>
              </div>

              {/* Feature Spec Footer Row */}
              <div className="pt-1.5 flex flex-wrap items-center justify-between gap-2.5 text-[10.5px] sm:text-[11.5px] font-semibold text-zinc-700">
                <div className="flex items-center gap-1.5">
                  <Lock className="size-3.5 text-zinc-950" />
                  <span>Secure by default</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Zap className="size-3.5 text-zinc-950" />
                  <span>Blazing fast</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Code className="size-3.5 text-zinc-950" />
                  <span>Open source</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Hero Illustration (/components/heroimage2.png) - Original Non-Inverted */}
        <div className="lg:col-span-6 flex items-center justify-center lg:justify-start lg:pl-6 xl:pl-8 w-full py-2 lg:py-0">
          <div className="relative w-full max-w-[460px] flex items-center justify-center select-none group">
            {/* Ambient Lighting Behind Illustration */}
            <div className="absolute inset-0 bg-white/[0.05] rounded-full blur-3xl -z-10 pointer-events-none" />

            {/* Original Non-Inverted Transparent PNG Illustration */}
            <div className="relative w-full transition-transform duration-500 hover:scale-[1.02]">
              <img
                src="/components/heroimage_hero.png"
                alt="OID Identity illustration"
                className="w-full h-auto object-contain block drop-shadow-[0_15px_35px_rgba(255,255,255,0.08)]"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}





