'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GooeyFilter } from './GooeyFilter';
import { Play, RotateCcw, CheckCircle2, ShieldCheck, Key, Lock, ArrowRight, Sparkles, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Stage {
  id: string;
  title: string;
  desc: string;
  icon: React.ElementType;
  output: string;
}

const STAGES: Stage[] = [
  {
    id: 'pkce',
    title: '1. PKCE Challenge',
    desc: 'Generate cryptographic code_verifier & SHA-256 code_challenge',
    icon: Lock,
    output: 'code_challenge=E9Melhoa2OwvFrGMTJgu... (S256)',
  },
  {
    id: 'auth_code',
    title: '2. Auth Code Emission',
    desc: 'User consents; authorization server issues temporary auth code',
    icon: Key,
    output: 'auth_code=ac_89f0a28bd931... (TTL 60s)',
  },
  {
    id: 'token_exchange',
    title: '3. Liquid Token Exchange',
    desc: 'Direct backend swap for signed RS256 ID token & Access token',
    icon: ShieldCheck,
    output: 'access_token=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
  },
];

export function FluidTokenPipeline() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const handleNext = () => {
    if (currentStep < STAGES.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleReset = () => {
    setCurrentStep(0);
    setIsPlaying(false);
  };

  const autoRun = async () => {
    setIsPlaying(true);
    setCurrentStep(0);
    await new Promise((r) => setTimeout(r, 900));
    setCurrentStep(1);
    await new Promise((r) => setTimeout(r, 1100));
    setCurrentStep(2);
    setIsPlaying(false);
  };

  return (
    <div className="relative rounded-3xl border border-border bg-card p-6 md:p-8 shadow-brutal-lg overflow-hidden">
      <GooeyFilter id="pipeline-gooey" strength="standard" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted/60 border border-border text-xs font-mono">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>OIDC 2.1 FLUID CONDUIT</span>
          </div>
          <h3 className="text-xl font-bold font-heading mt-2">Liquid Token Authorization Pipeline</h3>
          <p className="text-sm text-muted-foreground">
            Watch cryptographic tokens separate, flow, and coalesce into signed JWT sessions.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={autoRun}
            disabled={isPlaying}
            className="cursor-pointer gap-1.5"
          >
            <Play className="size-3.5 fill-current" />
            <span>Auto Run</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleReset}
            className="cursor-pointer"
          >
            <RotateCcw className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Main Conduit Visualization */}
      <div className="py-10 relative">
        {/* Gooey Conduit Pipe Layer */}
        <div
          className="relative flex items-center justify-between px-4 sm:px-12 my-6"
          style={{
            filter: 'url(#pipeline-gooey)',
            WebkitFilter: 'url(#pipeline-gooey)',
          }}
        >
          {/* Base Connecting Pipe */}
          <div className="absolute left-10 right-10 h-3 bg-muted/60 rounded-full" />

          {/* Animated Liquid Progress Stream */}
          <motion.div
            className="absolute left-10 h-3 bg-foreground rounded-full"
            animate={{
              width: `${(currentStep / (STAGES.length - 1)) * 80 + 10}%`,
            }}
            transition={{ type: 'spring', stiffness: 180, damping: 20 }}
          />

          {/* Traveling Satellite Fluid Droplets */}
          <motion.div
            className="absolute size-6 rounded-full bg-foreground"
            animate={{
              left: `calc(${(currentStep / (STAGES.length - 1)) * 75 + 10}% - 12px)`,
              scale: [1, 1.4, 0.9, 1.2, 1],
            }}
            transition={{
              left: { type: 'spring', stiffness: 220, damping: 18 },
              scale: { duration: 0.5, ease: 'easeInOut' },
            }}
          />

          {/* Liquid Node Droplets for each stage */}
          {STAGES.map((stage, idx) => {
            const isCompleted = idx <= currentStep;
            const isCurrent = idx === currentStep;

            return (
              <div
                key={stage.id}
                onClick={() => setCurrentStep(idx)}
                className="relative z-10 flex flex-col items-center cursor-pointer"
              >
                <motion.div
                  className={`size-14 rounded-full flex items-center justify-center transition-colors duration-300 ${
                    isCompleted ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'
                  }`}
                  animate={{
                    scale: isCurrent ? 1.18 : 1,
                  }}
                  transition={{ type: 'spring', stiffness: 350, damping: 15 }}
                >
                  <stage.icon className="size-6" />
                </motion.div>
              </div>
            );
          })}
        </div>

        {/* Labels underneath */}
        <div className="grid grid-cols-3 gap-2 px-2 text-center mt-3">
          {STAGES.map((stage, idx) => {
            const isCurrent = idx === currentStep;
            return (
              <div
                key={stage.id}
                onClick={() => setCurrentStep(idx)}
                className={`cursor-pointer p-2 rounded-xl transition-all ${
                  isCurrent ? 'bg-muted/50 font-semibold' : 'opacity-70 hover:opacity-100'
                }`}
              >
                <p className="text-xs sm:text-sm font-medium">{stage.title}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Stage Terminal Output Display */}
      <div className="rounded-2xl bg-muted/40 border border-border p-4 font-mono text-xs space-y-2">
        <div className="flex items-center justify-between text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Terminal className="size-3.5" />
            <span className="uppercase font-bold tracking-wider">
              {STAGES[currentStep].title}
            </span>
          </div>
          <span className="text-[10px] bg-background px-2 py-0.5 rounded border border-border">
            STEP {currentStep + 1} OF 3
          </span>
        </div>
        <p className="text-foreground text-sm font-medium">{STAGES[currentStep].desc}</p>
        <div className="p-3 rounded-lg bg-background border border-border/80 text-foreground overflow-x-auto">
          <span className="text-emerald-500 font-bold">$ </span>
          <code>{STAGES[currentStep].output}</code>
        </div>
      </div>

      {/* Interactive Step Buttons */}
      <div className="flex items-center justify-between mt-5 pt-4 border-t border-border">
        <Button
          size="sm"
          variant="secondary"
          onClick={handlePrev}
          disabled={currentStep === 0}
          className="cursor-pointer"
        >
          Previous Step
        </Button>
        <div className="flex gap-1.5">
          {STAGES.map((_, idx) => (
            <span
              key={idx}
              className={`size-2 rounded-full transition-all ${
                idx === currentStep ? 'w-6 bg-foreground' : 'bg-muted-foreground/30'
              }`}
            />
          ))}
        </div>
        <Button
          size="sm"
          variant="primary"
          onClick={handleNext}
          disabled={currentStep === STAGES.length - 1}
          className="cursor-pointer gap-1.5"
        >
          <span>Next Step</span>
          <ArrowRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
