'use client';

import React, { useRef, useCallback } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

interface AmbientFluidBackgroundProps {
  interactive?: boolean;
  className?: string;
  intensity?: 'subtle' | 'medium' | 'high';
}

export function AmbientFluidBackground({
  interactive = true,
  className = '',
  intensity = 'medium',
}: AmbientFluidBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(500);
  const mouseY = useMotionValue(300);
  const smoothX = useSpring(mouseX, { stiffness: 80, damping: 25 });
  const smoothY = useSpring(mouseY, { stiffness: 80, damping: 25 });

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!interactive || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      mouseX.set(e.clientX - rect.left);
      mouseY.set(e.clientY - rect.top);
    },
    [interactive, mouseX, mouseY]
  );

  const opacityMap = {
    subtle: 'opacity-15',
    medium: 'opacity-25',
    high: 'opacity-40',
  };

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      className={`pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background transition-colors duration-300 ${className}`}
    >
      {/* Subtle radial dot backdrop */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.05] dark:opacity-[0.08] text-foreground"
        style={{
          backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Floating Ambient Fluid Blobs */}
      <div className={`absolute inset-0 size-full filter blur-[80px] ${opacityMap[intensity]}`}>
        {/* Mouse Attractor Fluid Blob */}
        {interactive && (
          <motion.div
            className="absolute rounded-full bg-zinc-300 dark:bg-zinc-400"
            style={{
              x: smoothX,
              y: smoothY,
              width: 320,
              height: 320,
              marginLeft: -160,
              marginTop: -160,
            }}
            animate={{
              scale: [1, 1.2, 0.9, 1],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )}

        {/* Top-Left Ambient Orb */}
        <motion.div
          className="absolute -top-24 -left-24 size-[480px] rounded-full bg-zinc-200 dark:bg-zinc-500"
          animate={{
            x: [0, 60, -40, 0],
            y: [0, 40, -30, 0],
            scale: [1, 1.15, 0.95, 1],
          }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Top-Right Ambient Orb */}
        <motion.div
          className="absolute -top-12 -right-12 size-[420px] rounded-full bg-zinc-300 dark:bg-zinc-600"
          animate={{
            x: [0, -50, 30, 0],
            y: [0, 60, -40, 0],
            scale: [1, 1.2, 0.9, 1],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        />

        {/* Center-Right Ambient Orb */}
        <motion.div
          className="absolute top-1/2 -right-32 size-[520px] rounded-full bg-zinc-200 dark:bg-zinc-700"
          animate={{
            x: [0, -60, 40, 0],
            y: [0, -50, 30, 0],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        />

        {/* Bottom-Left Ambient Orb */}
        <motion.div
          className="absolute -bottom-32 -left-32 size-[460px] rounded-full bg-zinc-300 dark:bg-zinc-600"
          animate={{
            x: [0, 70, -30, 0],
            y: [0, -40, 50, 0],
          }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
        />
      </div>
    </div>
  );
}
