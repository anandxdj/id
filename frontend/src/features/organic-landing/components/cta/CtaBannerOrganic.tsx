'use client';

import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { ClaySculpture3D } from '../common/ClaySculpture3D';

interface CtaBannerOrganicProps {
  onGetStarted?: () => void;
}

export function CtaBannerOrganic({ onGetStarted }: CtaBannerOrganicProps) {
  return (
    <section className="relative mx-auto max-w-[1400px] px-2 sm:px-6 py-0">
      {/* 4th Section Organic Island Container */}
      <div className="relative w-full aspect-[880/135] min-h-[140px] md:min-h-[160px] flex items-center justify-between px-6 sm:px-12 md:px-16 lg:px-20 py-4 md:py-5 select-none overflow-hidden">
        {/* Background SVG: final_cta.svg */}
        <img
          src="/landing_components/final_cta.svg"
          alt=""
          className="absolute inset-0 w-full h-full object-fill pointer-events-none z-0 scale-y-[1.15]"
          aria-hidden="true"
        />

        {/* Inner Content Layer - perfectly centered inside the expanded white ribbon */}
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-5 md:gap-8 w-full">
          {/* Left Column: Heading & Subtitle */}
          <div className="space-y-1 max-w-md text-center md:text-left">
            <h2 className="font-heading text-lg sm:text-xl md:text-[24px] lg:text-[28px] font-black tracking-tight text-zinc-950 leading-[1.1]">
              Ready to take control
              <br />
              of identity?
            </h2>
            <p className="text-[11.5px] sm:text-xs text-zinc-600 font-normal leading-relaxed">
              Get started with OID and give your users a secure, seamless sign-in experience.
            </p>
          </div>

          {/* Center Action Button */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={onGetStarted}
              className="cursor-pointer inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-full bg-zinc-950 text-white font-bold text-xs sm:text-sm shadow-lg hover:bg-zinc-800 hover:scale-105 active:scale-95 transition-all duration-150"
            >
              <span>Get Started Now</span>
              <ArrowUpRight className="size-4" />
            </button>
          </div>

          {/* Far Right: 3D Clay Decorative Blob */}
          <div className="hidden lg:flex items-center justify-center shrink-0">
            <ClaySculpture3D />
          </div>
        </div>
      </div>
    </section>
  );
}




