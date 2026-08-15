'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { GooeyFilter } from './GooeyFilter';

interface Blob {
  id: number;
  baseX: number;
  baseY: number;
  size: number;
  vx: number;
  vy: number;
  phase: number;
  colorClass: string;
}

interface GooeyMetaballsHeroProps {
  blobCount?: number;
  interactive?: boolean;
  className?: string;
  speedMultiplier?: number;
  attractionStrength?: number;
  variant?: 'monochrome' | 'iridescent' | 'emerald';
}

export function GooeyMetaballsHero({
  blobCount = 6,
  interactive = true,
  className = '',
  speedMultiplier = 1,
  attractionStrength = 0.45,
  variant = 'monochrome',
}: GooeyMetaballsHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const [blobs, setBlobs] = useState<Blob[]>([]);

  // Mouse coords mapped with smooth spring
  const mouseX = useMotionValue(400);
  const mouseY = useMotionValue(250);
  const springX = useSpring(mouseX, { stiffness: 120, damping: 20 });
  const springY = useSpring(mouseY, { stiffness: 120, damping: 20 });

  // Update container dimensions
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        setDimensions({
          width: clientWidth || 800,
          height: clientHeight || 500,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Initialize organic blobs
  useEffect(() => {
    const colorClasses = {
      monochrome: [
        'bg-foreground/80 dark:bg-foreground/70',
        'bg-foreground/60 dark:bg-foreground/50',
        'bg-foreground/90 dark:bg-foreground/80',
        'bg-muted-foreground/50 dark:bg-muted-foreground/40',
        'bg-foreground/40 dark:bg-foreground/30',
      ],
      iridescent: [
        'bg-gradient-to-br from-foreground/80 via-muted-foreground/60 to-foreground/40',
        'bg-gradient-to-tr from-foreground/70 via-foreground/90 to-muted-foreground/30',
        'bg-gradient-to-r from-muted-foreground/70 to-foreground/60',
        'bg-gradient-to-b from-foreground/90 to-muted-foreground/40',
        'bg-gradient-to-tl from-foreground/50 via-foreground/80 to-foreground/30',
      ],
      emerald: [
        'bg-emerald-500/80 dark:bg-emerald-400/80',
        'bg-foreground/70 dark:bg-foreground/60',
        'bg-teal-500/70 dark:bg-teal-400/70',
        'bg-emerald-600/60 dark:bg-emerald-500/50',
        'bg-foreground/90 dark:bg-foreground/80',
      ],
    };

    const palette = colorClasses[variant] || colorClasses.monochrome;

    const initialBlobs: Blob[] = Array.from({ length: blobCount }, (_, i) => ({
      id: i,
      baseX: (dimensions.width / (blobCount + 1)) * (i + 1) + (Math.random() * 80 - 40),
      baseY: dimensions.height * 0.45 + (Math.random() * 80 - 40),
      size: 90 + Math.random() * 90,
      vx: (Math.random() - 0.5) * 1.5 * speedMultiplier,
      vy: (Math.random() - 0.5) * 1.5 * speedMultiplier,
      phase: Math.random() * Math.PI * 2,
      colorClass: palette[i % palette.length],
    }));

    setBlobs(initialBlobs);
  }, [blobCount, dimensions.width, dimensions.height, speedMultiplier, variant]);

  // Handle pointer tracking
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!interactive || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      mouseX.set(e.clientX - rect.left);
      mouseY.set(e.clientY - rect.top);
    },
    [interactive, mouseX, mouseY]
  );

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      className={`relative overflow-hidden ${className}`}
      style={{ touchAction: 'none' }}
    >
      <GooeyFilter id="hero-gooey-filter" strength="intense" />

      {/* Gooey Layer */}
      <div
        className="absolute inset-0 size-full pointer-events-none"
        style={{
          filter: 'url(#hero-gooey-filter)',
          WebkitFilter: 'url(#hero-gooey-filter)',
        }}
      >
        {/* Interactive Mouse Attraction Core Blob */}
        {interactive && (
          <motion.div
            className="absolute rounded-full bg-foreground/90 dark:bg-foreground/80 shadow-2xl backdrop-blur-sm"
            style={{
              x: springX,
              y: springY,
              width: 110,
              height: 110,
              marginLeft: -55,
              marginTop: -55,
            }}
            animate={{
              scale: [1, 1.15, 0.95, 1],
              borderRadius: ['50%', '42% 58% 60% 40% / 45% 45% 55% 55%', '50%'],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )}

        {/* Orbiting / Floating Metaballs */}
        {blobs.map((blob, idx) => {
          const moveRadiusX = 45 + (idx % 3) * 25;
          const moveRadiusY = 35 + (idx % 2) * 30;
          const duration = 6 + (idx % 4) * 2;

          return (
            <motion.div
              key={blob.id}
              className={`absolute rounded-full ${blob.colorClass} shadow-xl`}
              style={{
                width: blob.size,
                height: blob.size,
                left: blob.baseX - blob.size / 2,
                top: blob.baseY - blob.size / 2,
              }}
              animate={{
                x: [
                  0,
                  Math.cos(blob.phase) * moveRadiusX,
                  Math.sin(blob.phase + Math.PI / 2) * moveRadiusX * 0.8,
                  -Math.cos(blob.phase) * moveRadiusX * 0.6,
                  0,
                ],
                y: [
                  0,
                  Math.sin(blob.phase) * moveRadiusY,
                  -Math.cos(blob.phase) * moveRadiusY * 0.9,
                  Math.sin(blob.phase + Math.PI) * moveRadiusY * 0.5,
                  0,
                ],
                scale: [1, 1.12, 0.9, 1.05, 1],
                borderRadius: [
                  '50%',
                  '45% 55% 65% 35% / 40% 60% 40% 60%',
                  '60% 40% 30% 70% / 50% 30% 70% 50%',
                  '50%',
                ],
              }}
              transition={{
                duration: duration / speedMultiplier,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: idx * 0.4,
              }}
            />
          );
        })}
      </div>

      {/* Subtle Specular Top Sheen (Optional glass light overlay) */}
      <div className="pointer-events-none absolute inset-0 bg-radial from-foreground/[0.03] via-transparent to-transparent opacity-60" />
    </div>
  );
}
