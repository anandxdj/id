'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { GooeyFilter } from './GooeyFilter';
import { Sparkles, Terminal, User, Code, Shield } from 'lucide-react';

export type LiquidToggleVariant = 'jelly' | 'droplets' | 'slime';

interface Option {
  id: string;
  label: string;
  icon?: React.ElementType;
}

interface LiquidModeToggleProps {
  value: string;
  onChange: (value: string) => void;
  options?: Option[];
  variant?: LiquidToggleVariant;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const DEFAULT_OPTIONS: Option[] = [
  { id: 'user', label: 'User Mode', icon: User },
  { id: 'dev', label: 'Developer', icon: Code },
];

export function LiquidModeToggle({
  value,
  onChange,
  options = DEFAULT_OPTIONS,
  variant = 'jelly',
  className = '',
  size = 'md',
}: LiquidModeToggleProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const sizeClasses = {
    sm: 'text-xs px-3 py-1.5 gap-1.5 h-8',
    md: 'text-sm px-4 py-2 gap-2 h-10',
    lg: 'text-base px-5 py-2.5 gap-2.5 h-12',
  };

  const activeIndex = options.findIndex((opt) => opt.id === value);

  return (
    <div className={`relative inline-flex items-center select-none ${className}`}>
      {/* SVG Gooey Filter for liquid connection */}
      <GooeyFilter id="toggle-gooey" strength={variant === 'slime' ? 'intense' : 'standard'} />

      {/* Container with border & backdrop */}
      <div className="relative inline-flex p-1 rounded-full border border-border bg-card/90 shadow-sm backdrop-blur-md">
        {/* Gooey Layer for Liquid Sliding Indicator */}
        <div
          className="absolute inset-0 size-full pointer-events-none p-1"
          style={
            variant === 'droplets' || variant === 'slime'
              ? {
                  filter: 'url(#toggle-gooey)',
                  WebkitFilter: 'url(#toggle-gooey)',
                }
              : undefined
          }
        >
          {/* Main Active Liquid Blob */}
          {activeIndex >= 0 && (
            <motion.div
              layoutId="liquid-toggle-active-bg"
              className="absolute inset-y-1 rounded-full bg-primary text-primary-foreground shadow-md"
              style={{
                width: `calc(${100 / options.length}% - 8px)`,
                left: `calc(${(activeIndex * 100) / options.length}% + 4px)`,
              }}
              transition={{
                type: 'spring',
                stiffness: 380,
                damping: 24,
                mass: variant === 'jelly' ? 0.8 : 0.6,
              }}
            >
              {/* Internal subtle fluid shine */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-t from-transparent via-white/10 to-white/20 pointer-events-none" />
            </motion.div>
          )}

          {/* Liquid Splitting Satellite Droplets (for droplets variant) */}
          {variant === 'droplets' && (
            <motion.div
              className="absolute size-3 rounded-full bg-primary"
              animate={{
                left: `calc(${(activeIndex * 100) / options.length}% + 50%)`,
                top: '50%',
                y: '-50%',
                x: '-50%',
                scale: [0.6, 1.2, 0.8, 1],
              }}
              transition={{
                left: { type: 'spring', stiffness: 450, damping: 18 },
                scale: { duration: 0.35, ease: 'easeOut' },
              }}
            />
          )}
        </div>

        {/* Interactive Option Tabs */}
        {options.map((opt) => {
          const isActive = opt.id === value;
          const Icon = opt.icon;

          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              onMouseEnter={() => setHoveredId(opt.id)}
              onMouseLeave={() => setHoveredId(null)}
              className={`relative z-10 flex items-center justify-center rounded-full font-medium transition-colors duration-200 cursor-pointer ${
                sizeClasses[size]
              } ${
                isActive
                  ? 'text-primary-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {Icon && (
                <motion.div
                  animate={{
                    scale: isActive ? [1, 1.2, 1] : 1,
                    rotate: isActive ? [0, -6, 6, 0] : 0,
                  }}
                  transition={{ duration: 0.3 }}
                >
                  <Icon className="size-4" />
                </motion.div>
              )}
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
