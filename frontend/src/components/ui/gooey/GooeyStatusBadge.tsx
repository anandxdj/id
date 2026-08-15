'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { GooeyFilter } from './GooeyFilter';

interface GooeyStatusBadgeProps {
  status?: 'active' | 'warning' | 'error' | 'syncing';
  label?: string;
  className?: string;
}

export function GooeyStatusBadge({
  status = 'active',
  label = 'SYSTEM OPERATIONAL',
  className = '',
}: GooeyStatusBadgeProps) {
  const configs = {
    active: {
      color: 'bg-emerald-500',
      text: 'text-emerald-600 dark:text-emerald-400',
      border: 'border-emerald-500/20',
      glow: 'shadow-emerald-500/30',
    },
    warning: {
      color: 'bg-amber-500',
      text: 'text-amber-600 dark:text-amber-400',
      border: 'border-amber-500/20',
      glow: 'shadow-amber-500/30',
    },
    error: {
      color: 'bg-rose-500',
      text: 'text-rose-600 dark:text-rose-400',
      border: 'border-rose-500/20',
      glow: 'shadow-rose-500/30',
    },
    syncing: {
      color: 'bg-foreground',
      text: 'text-foreground',
      border: 'border-border',
      glow: 'shadow-foreground/20',
    },
  };

  const current = configs[status];

  return (
    <div
      className={`inline-flex items-center gap-2.5 px-3 py-1 rounded-full border bg-card/80 backdrop-blur-md shadow-sm ${current.border} ${className}`}
    >
      <GooeyFilter id={`badge-gooey-${status}`} strength="subtle" />

      {/* Gooey Pulsing Liquid Droplets */}
      <div
        className="relative size-3.5 flex items-center justify-center"
        style={{
          filter: `url(#badge-gooey-${status})`,
          WebkitFilter: `url(#badge-gooey-${status})`,
        }}
      >
        {/* Core Droplet */}
        <motion.div
          className={`absolute size-2 rounded-full ${current.color}`}
          animate={{
            scale: [1, 1.35, 1],
          }}
          transition={{
            duration: 2.2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        {/* Orbiting Satellite Micro-Droplet */}
        <motion.div
          className={`absolute size-1.5 rounded-full ${current.color}`}
          animate={{
            x: [0, 4, 0, -4, 0],
            y: [0, -4, 0, 4, 0],
            scale: [0.7, 1.2, 0.7],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      </div>

      <span className={`text-[11px] font-mono font-bold tracking-wider uppercase ${current.text}`}>
        {label}
      </span>
    </div>
  );
}
