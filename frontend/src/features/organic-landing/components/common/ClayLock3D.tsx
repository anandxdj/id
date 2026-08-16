'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';

/**
 * Puffy White 3D Clay Cushion with zero-gravity floating physics.
 */
export function ClayLock3D() {
  return (
    <motion.div
      whileHover={{ scale: 1.08, rotate: -2 }}
      transition={{ type: 'spring', stiffness: 350, damping: 18 }}
      className="relative flex items-center justify-center size-36 sm:size-44 md:size-48 lg:size-52 select-none cursor-pointer"
    >
      {/* Ambient Floor Shadow with out-of-sync breathing */}
      <motion.div
        animate={{
          scale: [0.85, 0.95, 0.85],
          opacity: [0.45, 0.35, 0.45],
        }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute inset-x-4 bottom-2 h-10 rounded-full bg-black/45 blur-xl -z-10"
      />

      {/* Floating 3D Cushion */}
      <motion.div
        animate={{
          y: [-4, 4, -4],
          rotate: [-1, 1, -1],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="relative size-full"
      >
        <svg
          viewBox="0 0 200 200"
          className="size-full filter drop-shadow-[0_15px_20px_rgba(0,0,0,0.25)]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient
              id="lockClayRadial"
              cx="40%"
              cy="35%"
              r="65%"
              fx="35%"
              fy="30%"
            >
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="45%" stopColor="#F5F5F7" />
              <stop offset="75%" stopColor="#E2E2E6" />
              <stop offset="95%" stopColor="#CCCCCC" />
              <stop offset="100%" stopColor="#BDBDC2" />
            </radialGradient>

            <radialGradient
              id="lockSpecularGlint"
              cx="32%"
              cy="28%"
              r="30%"
            >
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
              <stop offset="60%" stopColor="#FFFFFF" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Puffy Soft Squircle Cushion */}
          <path
            d="M 100 20
               C 155 20, 180 45, 180 100
               C 180 155, 155 180, 100 180
               C 45 180, 20 155, 20 100
               C 20 45, 45 20, 100 20 Z"
            fill="url(#lockClayRadial)"
          />

          {/* Glint Highlight */}
          <path
            d="M 100 20
               C 155 20, 180 45, 180 100
               C 180 155, 155 180, 100 180
               C 45 180, 20 155, 20 100
               C 20 45, 45 20, 100 20 Z"
            fill="url(#lockSpecularGlint)"
          />
        </svg>

        {/* Recessed Black Lock Icon in Center */}
        <div className="absolute inset-0 flex items-center justify-center">
          <Lock className="size-8 sm:size-9 md:size-10 text-zinc-950 stroke-[2.5]" />
        </div>
      </motion.div>
    </motion.div>
  );
}
