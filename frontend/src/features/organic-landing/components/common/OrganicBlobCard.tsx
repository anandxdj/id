'use client';

import React from 'react';

/**
 * OrganicBlobCard renders an authentic organic fluid blob container
 * matching the exact asymmetrical silhouette seen in the design reference.
 */

interface OrganicBlobCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'hero-left' | 'wide-island' | 'testimonial-card' | 'cta-capsule';
}

export function OrganicBlobCard({
  children,
  className = '',
  variant = 'hero-left',
}: OrganicBlobCardProps) {
  // Exact organic squircle border-radius matching the reference image's unique silhouettes
  const shapeStyles = {
    'hero-left': {
      borderRadius: '52px 64px 44px 58px / 60px 48px 62px 52px',
    },
    'wide-island': {
      borderRadius: '60px 54px 62px 50px / 52px 60px 50px 62px',
    },
    'testimonial-card': {
      borderRadius: '44px 38px 48px 40px / 40px 46px 38px 48px',
    },
    'cta-capsule': {
      borderRadius: '60px 60px 60px 60px / 50px 50px 50px 50px',
    },
  };

  return (
    <div
      className={`relative bg-white text-zinc-950 shadow-[0_30px_70px_-15px_rgba(0,0,0,0.5)] transition-all duration-300 ${className}`}
      style={shapeStyles[variant]}
    >
      {/* Crisp Content Layer */}
      <div className="relative z-10 size-full">{children}</div>
    </div>
  );
}
