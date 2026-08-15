'use client';

import React, { useState, useRef } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { GooeyFilter } from './GooeyFilter';
import { ArrowRight, Sparkles, Zap, Shield, Key } from 'lucide-react';

export type GooeyButtonVariant = 'droplet-orbit' | 'slime-press' | 'split-pill' | 'magnetic-blob';

interface GooeyButtonProps {
  children: React.ReactNode;
  variant?: GooeyButtonVariant;
  onClick?: () => void;
  icon?: React.ElementType;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'primary' | 'secondary' | 'emerald';
}

export function GooeyButton({
  children,
  variant = 'droplet-orbit',
  onClick,
  icon: Icon = ArrowRight,
  className = '',
  size = 'md',
  tone = 'primary',
}: GooeyButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Magnetic cursor tracking values
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 250, damping: 15 });
  const springY = useSpring(y, { stiffness: 250, damping: 15 });

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    // Magnetic pull dampening factor
    x.set((e.clientX - centerX) * 0.25);
    y.set((e.clientY - centerY) * 0.25);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    x.set(0);
    y.set(0);
  };

  const sizeClasses = {
    sm: 'text-xs px-3.5 py-1.5 h-9 rounded-full gap-2',
    md: 'text-sm px-5 py-2.5 h-11 rounded-full gap-2.5',
    lg: 'text-base px-7 py-3.5 h-14 rounded-full gap-3',
  };

  const toneClasses = {
    primary: 'bg-foreground text-background shadow-lg shadow-foreground/10',
    secondary: 'bg-muted text-foreground border border-border/80 hover:bg-muted/80',
    emerald: 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20 font-bold',
  };

  const dropletColor = tone === 'emerald' ? 'bg-emerald-500' : 'bg-foreground';

  return (
    <div className="relative inline-flex items-center justify-center">
      <GooeyFilter id="btn-gooey" strength="standard" />

      {/* Outer Gooey Physics Container */}
      <div
        className="relative inline-flex items-center justify-center p-2"
        style={
          variant === 'droplet-orbit' || variant === 'split-pill'
            ? {
                filter: 'url(#btn-gooey)',
                WebkitFilter: 'url(#btn-gooey)',
              }
            : undefined
        }
      >
        {/* Floating Satellite Droplets that detach on hover */}
        {variant === 'droplet-orbit' && (
          <>
            <motion.div
              className={`absolute size-4 rounded-full ${dropletColor}`}
              animate={{
                x: isHovered ? [0, 48, 40, -45, 0] : 0,
                y: isHovered ? [0, -18, 22, -10, 0] : 0,
                scale: isHovered ? [1, 1.3, 0.9, 1.2, 1] : 0.8,
              }}
              transition={{
                duration: 3,
                repeat: isHovered ? Infinity : 0,
                ease: 'easeInOut',
              }}
            />
            <motion.div
              className={`absolute size-3.5 rounded-full ${dropletColor}`}
              animate={{
                x: isHovered ? [0, -50, -35, 42, 0] : 0,
                y: isHovered ? [0, 16, -20, 12, 0] : 0,
                scale: isHovered ? [1, 1.2, 0.8, 1.1, 1] : 0.7,
              }}
              transition={{
                duration: 2.6,
                repeat: isHovered ? Infinity : 0,
                ease: 'easeInOut',
                delay: 0.2,
              }}
            />
          </>
        )}

        {/* The Main Button Element */}
        <motion.button
          ref={btnRef}
          type="button"
          onClick={onClick}
          onMouseMove={handleMouseMove}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={handleMouseLeave}
          onMouseDown={() => setIsPressed(true)}
          onMouseUp={() => setIsPressed(false)}
          style={{ x: springX, y: springY }}
          animate={{
            scale: isPressed ? 0.94 : isHovered ? 1.03 : 1,
            borderRadius:
              variant === 'slime-press' && isPressed
                ? '35% 65% 55% 45% / 60% 30% 70% 40%'
                : '9999px',
          }}
          transition={{
            type: 'spring',
            stiffness: 400,
            damping: 18,
          }}
          className={`relative z-10 inline-flex items-center justify-center font-medium cursor-pointer transition-all duration-150 active:scale-95 ${
            sizeClasses[size]
          } ${toneClasses[tone]} ${className}`}
        >
          {/* Subtle liquid sheen layer */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-t from-transparent via-white/5 to-white/20 pointer-events-none" />

          {/* Children & Icon */}
          <span className="relative z-10 flex items-center gap-2">
            {children}
            {Icon && (
              <motion.span
                animate={{
                  x: isHovered ? 4 : 0,
                  rotate: isHovered ? [0, -10, 10, 0] : 0,
                }}
                transition={{ duration: 0.25 }}
              >
                <Icon className="size-4" />
              </motion.span>
            )}
          </span>
        </motion.button>
      </div>
    </div>
  );
}
