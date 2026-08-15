'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface ClayBlob3DProps {
  label?: string;
  icon?: React.ElementType;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  shape?: 'amoeba' | 'lock-cushion' | 'pill' | 'sphere';
  floating?: boolean;
}

export function ClayBlob3D({
  label,
  icon: Icon,
  className = '',
  size = 'md',
  shape = 'amoeba',
  floating = true,
}: ClayBlob3DProps) {
  const sizeClasses = {
    sm: 'size-24 text-lg',
    md: 'size-40 text-2xl',
    lg: 'size-56 text-4xl',
    xl: 'size-72 text-5xl',
  };

  const morphShapes = {
    amoeba: [
      '55% 45% 65% 35% / 40% 60% 40% 60%',
      '40% 60% 35% 65% / 60% 40% 60% 40%',
      '60% 40% 50% 50% / 45% 55% 45% 55%',
      '55% 45% 65% 35% / 40% 60% 40% 60%',
    ],
    'lock-cushion': [
      '45% 55% 48% 52% / 52% 48% 55% 45%',
      '52% 48% 55% 45% / 45% 55% 48% 52%',
      '48% 52% 45% 55% / 55% 45% 52% 48%',
      '45% 55% 48% 52% / 52% 48% 55% 45%',
    ],
    pill: [
      '50px 80px 50px 80px / 70px 50px 70px 50px',
      '80px 50px 80px 50px / 50px 70px 50px 70px',
      '50px 80px 50px 80px / 70px 50px 70px 50px',
    ],
    sphere: ['50%', '48% 52% 50% 50%', '52% 48% 50% 50%', '50%'],
  };

  return (
    <motion.div
      animate={
        floating
          ? {
              y: [0, -10, 0, 10, 0],
              rotate: [0, 2, 0, -2, 0],
              borderRadius: morphShapes[shape],
            }
          : {
              borderRadius: morphShapes[shape],
            }
      }
      transition={{
        duration: 8,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      className={`relative flex items-center justify-center select-none ${sizeClasses[size]} ${className}`}
      style={{
        background:
          'radial-gradient(circle at 35% 30%, #ffffff 0%, #f4f4f5 45%, #e4e4e7 80%, #d4d4d8 100%)',
        boxShadow: `
          inset 0 10px 20px rgba(255, 255, 255, 0.9),
          inset 0 -15px 30px rgba(0, 0, 0, 0.15),
          0 25px 50px -12px rgba(0, 0, 0, 0.4),
          0 10px 20px -5px rgba(0, 0, 0, 0.2)
        `,
      }}
    >
      {/* Specular Glint Highlight */}
      <div
        className="pointer-events-none absolute top-4 left-6 size-12 rounded-full bg-white/70 blur-[3px]"
        style={{
          transform: 'rotate(-25deg) scale(1.4, 0.7)',
        }}
      />

      {/* Label or Icon */}
      {label && (
        <span className="relative z-10 font-heading font-black tracking-tight text-zinc-950">
          {label}
        </span>
      )}

      {Icon && (
        <div className="relative z-10 text-zinc-950">
          <Icon className="size-1/2 min-w-10 min-h-10" />
        </div>
      )}
    </motion.div>
  );
}
