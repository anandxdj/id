'use client';

import React from 'react';
import { motion } from 'framer-motion';

/**
 * 3D Organic Puffy Clay Sculpture with zero-gravity floating motion.
 */
export function ClaySculpture3D() {
  return (
    <motion.div
      whileHover={{ scale: 1.08, rotate: 3 }}
      transition={{ type: 'spring', stiffness: 350, damping: 18 }}
      className="relative flex items-center justify-center size-44 sm:size-52 md:size-60 select-none cursor-pointer"
    >
      <motion.div
        animate={{
          y: [-5, 5, -5],
          rotate: [-1.5, 1.5, -1.5],
        }}
        transition={{
          duration: 7,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="relative size-full"
      >
        <svg
          viewBox="0 0 200 200"
          className="size-full filter drop-shadow-[0_20px_25px_rgba(0,0,0,0.25)]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient
              id="sculptureClayRadial"
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
              id="sculptureSpecularGlint"
              cx="32%"
              cy="28%"
              r="30%"
            >
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
              <stop offset="60%" stopColor="#FFFFFF" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Organic Morphing 3D Blob */}
          <path
            d="M 120 30
               C 170 30, 190 70, 180 120
               C 170 170, 130 180, 90 175
               C 45 170, 20 140, 25 90
               C 30 45, 70 30, 120 30 Z"
            fill="url(#sculptureClayRadial)"
          />

          <path
            d="M 120 30
               C 170 30, 190 70, 180 120
               C 170 170, 130 180, 90 175
               C 45 170, 20 140, 25 90
               C 30 45, 70 30, 120 30 Z"
            fill="url(#sculptureSpecularGlint)"
          />
        </svg>
      </motion.div>
    </motion.div>
  );
}
