'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowUpRight, FileText, Circle } from 'lucide-react';
import { FigmaConnectedHub } from './FigmaConnectedHub';

interface FigmaHeroProps {
  onGetStarted?: () => void;
  onViewDocs?: () => void;
}

export function FigmaHero({ onGetStarted, onViewDocs }: FigmaHeroProps) {
  return (
    <section className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-4 pb-2">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 xl:gap-10 items-center">
        {/* LEFT COLUMN: Organic Blob Card */}
        <div className="lg:col-span-6 flex justify-center lg:justify-end">
          <div className="relative w-full max-w-[570px] aspect-[407/419] flex items-center justify-center p-6 sm:p-8 md:p-10 select-none">
            {/* Background SVG: hero.svg */}
            <img
              src="/landing_components/hero.svg"
              alt=""
              className="absolute inset-0 w-full h-full object-fill pointer-events-none z-0 scale-[1.02] origin-center"
              aria-hidden="true"
            />

            {/* Inner Content Layer */}
            <div className="relative z-10 w-full max-w-[440px] flex flex-col justify-center space-y-4 px-2 sm:px-5 py-2">
              {/* Spec Tag Pill */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-black/5 border border-black/10 select-none w-fit">
                <span className="size-1.5 rounded-full bg-zinc-900" />
                <span className="text-[11px] sm:text-xs font-semibold tracking-wide text-zinc-900 font-sans">
                  OpenID Connect • Built for Scale
                </span>
              </div>

              {/* Headline */}
              <h1 className="font-heading text-2xl sm:text-3xl md:text-[2.6rem] lg:text-[2.9rem] font-black tracking-tight text-zinc-950 leading-[1.05]">
                Authentication
                <br />
                done right.
                <br />
                OpenID Connect
                <br />
                made simple.
              </h1>

              {/* Description */}
              <p className="text-xs sm:text-[13.5px] md:text-[14px] text-zinc-600 font-normal leading-relaxed max-w-[400px]">
                OID gives you a pure, standards-compliant identity platform to power SSO, manage users, and protect access—all for you to own.
              </p>

              {/* Action Buttons */}
              <div className="pt-1 flex flex-wrap items-center gap-3">
                <Link href="/login">
                  <button
                    type="button"
                    onClick={onGetStarted}
                    className="cursor-pointer inline-flex items-center gap-2.5 px-5 sm:px-6 py-2.5 sm:py-3 rounded-full bg-zinc-950 text-white font-semibold text-xs sm:text-sm shadow-lg hover:bg-zinc-800 hover:scale-105 active:scale-95 transition-all duration-150"
                  >
                    <span>Get Started</span>
                    <span className="size-4 rounded-full bg-white/20 flex items-center justify-center">
                      <ArrowUpRight className="size-3 text-white" />
                    </span>
                  </button>
                </Link>

                <a href="#docs">
                  <button
                    type="button"
                    onClick={onViewDocs}
                    className="cursor-pointer inline-flex items-center gap-2 px-4.5 sm:px-5 py-2.5 sm:py-3 rounded-full bg-white/90 text-zinc-900 font-semibold text-xs sm:text-sm border border-zinc-300 hover:bg-white hover:scale-105 active:scale-95 transition-all duration-150 shadow-xs"
                  >
                    <span>View Docs</span>
                    <FileText className="size-3.5 text-zinc-700" />
                  </button>
                </a>
              </div>

              {/* Feature Spec Footer Row */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-2.5 text-[11px] sm:text-[12px] font-semibold text-zinc-700">
                <div className="flex items-center gap-1.5">
                  <Circle className="size-2 text-zinc-900 fill-zinc-900" />
                  <span>Self-Hosted</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Circle className="size-2 text-zinc-900 fill-zinc-900" />
                  <span>Open Standards</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Circle className="size-2 text-zinc-900 fill-zinc-900" />
                  <span>Privacy First</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Connected Organic Hub */}
        <div className="lg:col-span-6 flex items-center justify-center lg:justify-start lg:pl-2 xl:pl-4 w-full py-2 lg:py-0">
          <FigmaConnectedHub />
        </div>
      </div>
    </section>
  );
}
