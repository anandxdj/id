'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { ClaySculpture3D } from '../common/ClaySculpture3D';
import { MagneticButton } from '@/components/ui/gooey';

interface CtaBannerOrganicProps {
  onGetStarted?: () => void;
}

export function CtaBannerOrganic({ onGetStarted }: CtaBannerOrganicProps) {
  return (
    <section className="relative mx-auto max-w-[1400px] px-3 py-1 sm:px-8 sm:py-2">
      {/* 4th Section Organic Island Container */}
      <motion.div
        initial={{ opacity: 0, y: 25 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex min-h-[210px] w-full items-center justify-between px-6 py-10 select-none sm:min-h-[200px] sm:px-12 sm:py-10 md:min-h-[220px] md:px-16 md:py-8 lg:aspect-[880/135] lg:px-20"
      >
        {/* Background SVG */}
        <img
          src="/landing_components/final_cta.svg"
          alt=""
          className="absolute inset-0 w-full h-full object-fill pointer-events-none z-0 animate-island-breathe filter invert dark:filter-none drop-shadow-md transition-[filter] duration-300"
          aria-hidden="true"
        />

        {/* Inner Content Layer */}
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6 md:gap-8 w-full">
          {/* Left Column: Heading & Subtitle */}
          <div className="space-y-1.5 max-w-md text-center md:text-left">
            <h2 className="font-heading text-lg sm:text-xl md:text-[24px] lg:text-[28px] font-black tracking-tight text-zinc-50 dark:text-zinc-950 leading-[1.15]">
              One identity for
              <br />
              every internal app.
            </h2>
            <p className="text-[11.5px] sm:text-xs text-zinc-300 dark:text-zinc-600 font-normal leading-relaxed">
              Sign in to manage your account, or connect an application through standard OpenID Connect.
            </p>
          </div>

          {/* Center Action Button with Magnetic attraction */}
          <div className="flex items-center shrink-0">
            <MagneticButton strength={0.28}>
              <button
                type="button"
                onClick={onGetStarted}
                className="cursor-pointer inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-full bg-white text-zinc-950 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-white dark:hover:bg-zinc-800 font-bold text-xs sm:text-sm shadow-lg transition-all duration-150 active:scale-95"
              >
                <span>Sign in to ID</span>
                <ArrowUpRight className="size-4" />
              </button>
            </MagneticButton>
          </div>

          {/* Far Right: 3D Clay Decorative Blob */}
          <div className="hidden lg:flex items-center justify-center shrink-0">
            <ClaySculpture3D />
          </div>
        </div>
      </motion.div>
    </section>
  );
}
