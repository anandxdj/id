'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

interface FigmaCtaBannerProps {
  className?: string;
  primaryHref?: string;
  onGetStarted?: () => void;
}

/**
 * Final CTA banner — Figma node 1:4543.
 * Island bbox (30.5, 1416.8, 879.0 x 124.2) → final_cta.svg (880 x 125).
 * Right-hand decor is a flat two-tone lumpy blob (139 x 81 at 694.1, 1453.4),
 * extracted as cta_blob.svg — replaces the former 3D clay sculpture.
 */
export function FigmaCtaBanner({ className = '', primaryHref = '/login', onGetStarted }: FigmaCtaBannerProps) {
  return (
    <section
      className={`relative w-full select-none px-4 py-6 sm:px-6 lg:aspect-[941/124.2] lg:px-0 lg:py-0 ${className}`}
    >
      <div className="@container relative w-full lg:absolute lg:inset-y-0 lg:left-[3.241%] lg:w-[93.411%]">
        <img
          src="/landing_components/final_cta.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 size-full object-fill filter invert dark:filter-none drop-shadow-sm transition-[filter] duration-300"
        />

        {/* Flat decor blob, bbox 75.49% / 29.47% of the island */}
        <img
          src="/landing_components/cta_blob.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute z-0 hidden lg:block lg:left-[75.49%] lg:top-[29.47%] lg:h-[64.98%] lg:w-[15.77%] filter invert dark:filter-none drop-shadow-sm"
        />

        <div className="relative z-10 flex flex-col items-center gap-6 px-6 py-8 text-center lg:contents lg:px-0 lg:py-0 lg:text-left">
          {/* Left: heading & subtitle, x 121.3 → 333.1 of the island */}
          <div className="max-w-md space-y-1.5 lg:absolute lg:left-[10.33cqw] lg:top-[21.66%] lg:max-w-[26cqw] lg:space-y-[0.6cqw]">
            <h2 className="font-heading text-lg font-black leading-[1.09] tracking-tight text-zinc-50 dark:text-zinc-950 sm:text-xl lg:text-[2.58cqw]">
              Ready to take control
              <br />
              of your identity?
            </h2>
            <p className="text-[11.5px] font-normal leading-relaxed text-zinc-300 dark:text-zinc-600 lg:text-[1.14cqw] lg:leading-[1.45]">
              Start your self-hosted OpenID platform in minutes. No vendor lock-in. Just pure freedom.
            </p>
          </div>

          {/* Centre: primary action + micro-copy. Pill (499.7, 1458.9, 133.9 x 39.1) */}
          <div className="flex shrink-0 flex-col items-center gap-1.5 lg:absolute lg:left-[53.38%] lg:top-[33.90%] lg:w-[15.23%] lg:items-start lg:gap-[1cqw]">
            <Link href={primaryHref} className="w-full">
              <button
                type="button"
                onClick={onGetStarted}
                className="inline-flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-full bg-white text-zinc-950 hover:bg-zinc-100 dark:bg-zinc-950 dark:text-white dark:hover:bg-zinc-800 px-6 py-2.5 text-xs font-bold shadow-lg transition-all duration-150 hover:scale-105 active:scale-95 lg:h-[4.448cqw] lg:gap-[0.9cqw] lg:px-0 lg:py-0 lg:text-[1.08cqw]"
              >
                <span>Get started free</span>
                <span className="flex size-4 items-center justify-center rounded-full bg-black/10 text-black dark:bg-white/20 dark:text-white lg:size-[1.3cqw]">
                  <ArrowUpRight className="size-3 lg:size-[1cqw]" />
                </span>
              </button>
            </Link>
            <span className="whitespace-nowrap text-[10px] font-medium text-zinc-400 dark:text-zinc-500 lg:text-[0.91cqw]">
              Free and open source forever.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
