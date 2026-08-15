'use client';

import React from 'react';
import { ArrowUpRight, ShieldCheck, Lock, Play, RotateCcw, Terminal } from 'lucide-react';
import { OrganicBlobContainer } from '../common/OrganicBlobContainer';
import { FluidTokenPipeline } from '@/components/ui/gooey/FluidTokenPipeline';

interface HeroVariantInteractiveSimProps {
  onGetStarted?: () => void;
  onViewDocs?: () => void;
}

export function HeroVariantInteractiveSim({
  onGetStarted,
  onViewDocs,
}: HeroVariantInteractiveSimProps) {
  return (
    <section className="relative mx-auto max-w-7xl px-4 sm:px-6 py-8 md:py-14">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Left Column: Heading Blob Card */}
        <div className="lg:col-span-5">
          <OrganicBlobContainer
            variant="dynamic"
            bgTone="light"
            className="p-8 sm:p-10 md:p-12"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 border border-zinc-200/80 mb-5">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-semibold text-zinc-900">
                Interactive Auth Simulator
              </span>
            </div>

            <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-zinc-950 leading-[1.08]">
              Cryptographic
              <br />
              Precision Engine.
            </h1>

            <p className="mt-5 text-sm text-zinc-600 font-normal leading-relaxed">
              Step through the complete PKCE authorization exchange in real-time. Test OAuth 2.1 code issuance, RS256 token verification, and granular user consent.
            </p>

            <div className="mt-8 flex items-center gap-3">
              <button
                type="button"
                onClick={onGetStarted}
                className="cursor-pointer inline-flex items-center gap-2 px-6 py-3 rounded-full bg-zinc-950 text-white font-bold text-sm shadow-xl hover:bg-zinc-800 transition-all"
              >
                <span>Launch Cluster</span>
                <ArrowUpRight className="size-4" />
              </button>
            </div>
          </OrganicBlobContainer>
        </div>

        {/* Right Column: Fluid Token Conduit Pipeline */}
        <div className="lg:col-span-7">
          <FluidTokenPipeline />
        </div>
      </div>
    </section>
  );
}
