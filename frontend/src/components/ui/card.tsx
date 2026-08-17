"use client";

import { useState, type HTMLAttributes } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'standard' | 'gooey' | 'organic';
}

export function Card({ className, variant = 'standard', children, ...props }: CardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  if (variant === 'organic') {
    const hasOrganicShape = className?.includes('shape-organic-');
    return (
      <div
        className={cn(
          'w-full border p-6 bg-[var(--organic-bg)] text-[var(--organic-foreground)] border-[var(--organic-border)] shadow-brutal transition-all duration-300',
          !hasOrganicShape && 'shape-organic-md',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }

  if (variant === 'gooey') {
    const animateBlobs = isHovered && !prefersReducedMotion;

    return (
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          'relative w-full overflow-hidden rounded-2xl border border-border/70 bg-card/90 p-6 shadow-brutal-sm backdrop-blur-xl transition-[border-color,box-shadow] duration-300 sm:p-7 hover:border-border hover:shadow-brutal',
          className
        )}
        {...props}
      >
        {/* Organic Gooey Backdrop inside the border bounds */}
        <div
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden opacity-55"
          style={{ filter: 'url(#gooey-global)' }}
        >
          {/* Main central blob */}
          <motion.div
            className="absolute bg-card inset-4 rounded-full"
            animate={
              animateBlobs
                ? { scale: [1, 1.06, 0.96, 1], x: [0, 4, -4, 0], y: [0, -3, 3, 0] }
                : { scale: 1, x: 0, y: 0 }
            }
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />
          {/* Top Left Blob */}
          <motion.div
            className="absolute bg-card size-36 rounded-full"
            animate={
              animateBlobs
                ? { x: [0, -12, 6, 0], y: [0, 6, -10, 0], scale: [1, 1.15, 0.85, 1] }
                : { x: 0, y: 0, scale: 1 }
            }
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            style={{ top: '-15%', left: '-15%' }}
          />
          {/* Top Right Blob */}
          <motion.div
            className="absolute bg-card size-36 rounded-full"
            animate={
              animateBlobs
                ? { x: [0, 10, -8, 0], y: [0, -10, 6, 0], scale: [1, 0.85, 1.15, 1] }
                : { x: 0, y: 0, scale: 1 }
            }
            transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
            style={{ top: '-15%', right: '-15%' }}
          />
          {/* Bottom Left Blob */}
          <motion.div
            className="absolute bg-card size-36 rounded-full"
            animate={
              animateBlobs
                ? { x: [0, -8, 10, 0], y: [0, 10, -6, 0], scale: [1, 1.1, 0.9, 1] }
                : { x: 0, y: 0, scale: 1 }
            }
            transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut' }}
            style={{ bottom: '-15%', left: '-15%' }}
          />
          {/* Bottom Right Blob */}
          <motion.div
            className="absolute bg-card size-36 rounded-full"
            animate={
              animateBlobs
                ? { x: [0, 12, -6, 0], y: [0, -6, 10, 0], scale: [1, 1.2, 0.85, 1] }
                : { x: 0, y: 0, scale: 1 }
            }
            transition={{ duration: 5.2, repeat: Infinity, ease: 'easeInOut' }}
            style={{ bottom: '-15%', right: '-15%' }}
          />
        </div>

        {/* Content Overlay */}
        <div className="relative z-10 w-full h-full text-card-foreground">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn('w-full border border-border/50 bg-card/70 backdrop-blur-md p-6 shadow-md rounded-xl', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1
      className={cn('font-heading text-xl font-bold tracking-tight text-card-foreground', className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('mt-1 text-sm text-muted-foreground', className)} {...props} />;
}
