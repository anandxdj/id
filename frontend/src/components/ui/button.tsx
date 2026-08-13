"use client";

import { forwardRef, useState, type ButtonHTMLAttributes } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  organic?: boolean;
}

const variants: Record<Variant, string> = {
  primary: 'text-brand-foreground border-transparent',
  secondary: 'text-secondary-foreground border-border/40',
  danger: 'text-danger-foreground border-transparent',
  ghost: 'text-foreground border-transparent hover:bg-accent/40',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-xs',
  md: 'h-10.5 px-5 text-sm',
  lg: 'h-12 px-6.5 text-sm font-semibold',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', organic = false, children, ...props }, ref) => {
    const [isHovered, setIsHovered] = useState(false);
    const [ripple, setRipple] = useState<{ x: number; y: number; id: number } | null>(null);

    // Determine background blob colors based on variants
    const blobColorClass = {
      primary: 'bg-brand',
      secondary: 'bg-secondary',
      danger: 'bg-danger',
      ghost: 'bg-accent/30',
    }[variant];

    const hasGooeyBg = variant !== 'ghost' && !organic;

    const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setRipple({ x, y, id: Date.now() });
    };

    return (
      <button
        ref={ref}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onMouseDown={handleMouseDown}
        className={cn(
          'relative inline-flex items-center justify-center gap-2 border font-sans font-medium overflow-hidden',
          organic 
            ? 'shape-organic-pill bg-[var(--organic-bg)] text-[var(--organic-foreground)] border-[var(--organic-border)] shadow-brutal-sm hover:scale-[1.02] active:scale-98'
            : cn('rounded-xl cursor-pointer active:scale-98 select-none shadow-sm', variants[variant]),
          'transition-all duration-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100',
          sizes[size],
          className,
        )}
        {...props}
      >
        {/* Liquid Gooey Background Blobs */}
        {hasGooeyBg && (
          <div
            className="absolute inset-0 z-0 pointer-events-none overflow-hidden rounded-xl"
            style={{ filter: 'url(#gooey-global)' }}
          >
            {/* Center Main Blob */}
            <motion.div
              className={cn('absolute rounded-full', blobColorClass)}
              initial={{ scale: 1, x: 0, y: 0 }}
              animate={
                isHovered
                  ? { scale: [1, 1.12, 1.08], x: [0, 4, -2, 0], y: [0, -2, 3, 0] }
                  : { scale: 1, x: 0, y: 0 }
              }
              transition={{ duration: 0.6, ease: 'easeInOut' }}
              style={{
                top: '-10%',
                left: '-10%',
                right: '-10%',
                bottom: '-10%',
              }}
            />
            {/* Left Bubble Blob */}
            <motion.div
              className={cn('absolute rounded-full size-12', blobColorClass)}
              animate={
                isHovered
                  ? { x: ['-20%', '25%', '0%'], y: ['-10%', '10%', '-10%'], scale: [0.8, 1.1, 0.9] }
                  : { x: '-20%', y: '10%', scale: 0.8 }
              }
              transition={{ duration: 0.7, ease: 'easeInOut' }}
              style={{ top: '20%', left: '10%' }}
            />
            {/* Right Bubble Blob */}
            <motion.div
              className={cn('absolute rounded-full size-10', blobColorClass)}
              animate={
                isHovered
                  ? { x: ['20%', '-20%', '0%'], y: ['15%', '-5%', '15%'], scale: [0.9, 1.15, 1] }
                  : { x: '20%', y: '-10%', scale: 0.9 }
              }
              transition={{ duration: 0.8, ease: 'easeInOut', delay: 0.05 }}
              style={{ bottom: '15%', right: '15%' }}
            />

            {/* Coordinate-based Click Ripple Blob */}
            {ripple && (
              <motion.div
                key={ripple.id}
                className={cn('absolute rounded-full pointer-events-none origin-center', blobColorClass)}
                initial={{ scale: 0, x: ripple.x - 20, y: ripple.y - 20 }}
                animate={{ scale: 4.5 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                onAnimationComplete={() => setRipple(null)}
                style={{
                  left: 0,
                  top: 0,
                  width: '40px',
                  height: '40px',
                }}
              />
            )}
          </div>
        )}

        {/* Text/Content Overlay */}
        <span className="relative z-10 flex items-center justify-center gap-2">
          {children}
        </span>
      </button>
    );
  },
);
Button.displayName = 'Button';
