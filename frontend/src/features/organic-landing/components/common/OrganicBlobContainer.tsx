'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface OrganicBlobContainerProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'subtle' | 'dynamic' | 'blobby' | 'capsule';
  bgTone?: 'light' | 'dark' | 'glass';
  interactive?: boolean;
}

export function OrganicBlobContainer({
  children,
  className = '',
  variant = 'dynamic',
  bgTone = 'light',
  interactive = true,
}: OrganicBlobContainerProps) {
  // Organic morphing border-radius keyframes
  const morphKeyframes = {
    subtle: [
      '38px 46px 42px 48px / 44px 40px 48px 42px',
      '44px 38px 48px 40px / 40px 46px 42px 46px',
      '40px 44px 38px 46px / 46px 42px 44px 40px',
      '38px 46px 42px 48px / 44px 40px 48px 42px',
    ],
    dynamic: [
      '50px 70px 45px 65px / 60px 45px 65px 50px',
      '65px 45px 60px 50px / 45px 65px 50px 60px',
      '45px 65px 50px 60px / 65px 50px 45px 65px',
      '50px 70px 45px 65px / 60px 45px 65px 50px',
    ],
    blobby: [
      '60px 85px 50px 90px / 80px 55px 85px 60px',
      '80px 55px 85px 60px / 60px 85px 50px 90px',
      '55px 80px 60px 85px / 85px 60px 55px 80px',
      '60px 85px 50px 90px / 80px 55px 85px 60px',
    ],
    capsule: [
      '40px 40px 40px 40px / 40px 40px 40px 40px',
      '48px 36px 46px 38px / 38px 46px 36px 48px',
      '36px 48px 38px 46px / 46px 38px 48px 36px',
      '40px 40px 40px 40px / 40px 40px 40px 40px',
    ],
  };

  const bgClasses = {
    light: 'bg-white text-zinc-950 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.35)]',
    dark: 'bg-zinc-900/90 text-zinc-100 border border-zinc-800 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.6)]',
    glass: 'bg-white/90 dark:bg-zinc-900/90 text-foreground backdrop-blur-xl border border-white/20 dark:border-zinc-800 shadow-2xl',
  };

  return (
    <motion.div
      animate={{
        borderRadius: morphKeyframes[variant],
      }}
      transition={{
        duration: 12,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      whileHover={
        interactive
          ? {
              scale: 1.006,
              transition: { duration: 0.3 },
            }
          : undefined
      }
      className={`relative overflow-hidden transition-shadow duration-300 ${bgClasses[bgTone]} ${className}`}
    >
      {/* Subtle top organic specular reflection sheen */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/[0.03] to-transparent opacity-80" />
      
      {/* Content */}
      <div className="relative z-10 size-full">{children}</div>
    </motion.div>
  );
}
