'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { FigmaClaySculpture } from './FigmaClaySculpture';

interface FigmaCtaBannerProps {
  onGetStarted?: () => void;
}

export function FigmaCtaBanner({ onGetStarted }: FigmaCtaBannerProps) {
  return (
    <section className="relative mx-auto max-w-[1400px] px-2 sm:px-6 py-4">
      {/* 4th Section Organic Island Container */}
      <div className="relative w-full aspect-[880/135] min-h-[140px] md:min-h-[160px] flex items-center justify-between px-6 sm:px-12 md:px-16 lg:px-20 py-4 md:py-5 select-none overflow-hidden">
        {/* Background SVG: final_cta.svg */}
        <img
          src="/landing_components/final_cta.svg"
          alt=""
          className="absolute inset-0 w-full h-full object-fill pointer-events-none z-0 scale-y-[1.15]"
          aria-hidden="true"
        />

        {/* Inner Content Layer */}
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-5 md:gap-8 w-full">
          {/* Left Column: Heading & Subtitle */}
          <div className="space-y-1.5 max-w-md text-center md:text-left">
            <h2 className="font-heading text-lg sm:text-xl md:text-[24px] lg:text-[28px] font-black tracking-tight text-zinc-950 leading-[1.1]">
              Ready to take control
              <br />
              of your identity?
            </h2>
            <p className="text-[11.5px] sm:text-xs text-zinc-600 font-normal leading-relaxed">
              Start your self-hosted OpenID platform in minutes. No vendor lock-in. Just pure freedom.
            </p>
          </div>

          {/* Center Action Button & Micro-copy */}
          <div className="flex flex-col items-center gap-1.5 shrink-0">
            <Link href="/login">
              <button
                type="button"
                onClick={onGetStarted}
                className="cursor-pointer inline-flex items-center gap-2.5 px-6 sm:px-7 py-2.5 sm:py-3 rounded-full bg-zinc-950 text-white font-bold text-xs sm:text-sm shadow-lg hover:bg-zinc-800 hover:scale-105 active:scale-95 transition-all duration-150"
              >
                <span>Get started free</span>
                <span className="size-4 rounded-full bg-white/20 flex items-center justify-center">
                  <ArrowUpRight className="size-3 text-white" />
                </span>
              </button>
            </Link>
            <span className="text-[10px] sm:text-[11px] text-zinc-500 font-medium">
              Free and open source forever.
            </span>
          </div>

          {/* Far Right: 3D Clay Decorative Sculpture */}
          <div className="hidden lg:flex items-center justify-center shrink-0">
            <FigmaClaySculpture />
          </div>
        </div>
      </div>
    </section>
  );
}
