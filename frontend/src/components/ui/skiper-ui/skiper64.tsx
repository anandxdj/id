"use client";

import { motion } from "framer-motion";
import React from "react";

const Skiper64 = () => {
  return (
    <div className="relative flex h-72 w-full flex-col items-center justify-between border border-[var(--organic-border)] bg-[var(--organic-bg)] text-[var(--organic-foreground)] p-8 shadow-brutal-sm shape-organic-md transition-all duration-300">
      <SkiperGooeyFilterProvider />
      <div className="grid content-start justify-items-center gap-1 text-center">
        <span className="font-heading text-xs font-bold uppercase tracking-tight text-[var(--organic-foreground)]">
          Interactive Gooey Sandbox
        </span>
        <span className="text-[10px] uppercase font-mono text-[var(--organic-foreground)]/60">
          Drag the elements to see the effect
        </span>
      </div>
      
      <ul
        className="relative flex flex-col items-center justify-center h-32 w-32 mb-2"
        style={{
          filter: "url(#SkiperGooeyFilter)",
        }}
      >
        <motion.li
          drag
          dragConstraints={{ top: -70, bottom: 70, left: -70, right: 70 }}
          initial={INITIAL_STATE}
          animate={ANIMATED_STATE}
          className="bg-[var(--organic-foreground)] absolute cursor-grab active:cursor-grabbing"
        ></motion.li>
        <motion.li
          drag
          dragConstraints={{ top: -70, bottom: 70, left: -70, right: 70 }}
          className="bg-[var(--organic-foreground)] size-12 rounded-full cursor-grab active:cursor-grabbing"
        ></motion.li>
      </ul>
    </div>
  );
};

const SkiperGooeyFilterProvider = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="absolute size-0 pointer-events-none"
      version="1.1"
    >
      <defs>
        <filter id="SkiperGooeyFilter">
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -7"
            result="SkiperGooeyFilter"
          />
          <feBlend in="SourceGraphic" in2="SkiperGooeyFilter" />
        </filter>
      </defs>
    </svg>
  );
};

const LOGO_SPRING = {
  type: "spring" as const,
  stiffness: 300,
  damping: 30,
};

const INITIAL_STATE = {
  y: 0,
  width: 48,
  height: 48,
  borderRadius: 40,
};

const ANIMATED_STATE = {
  y: -40,
  width: 80,
  height: 48,
  borderRadius: 24,
  transition: {
    ...LOGO_SPRING,
    delay: 0.15,
    y: {
      ...LOGO_SPRING,
      delay: 0,
    },
  },
};

export { Skiper64, SkiperGooeyFilterProvider };
