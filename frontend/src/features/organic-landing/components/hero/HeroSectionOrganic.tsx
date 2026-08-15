'use client';

import React from 'react';
import { HeroVariantConnectedHub } from './HeroVariantConnectedHub';
import { HeroVariantInteractiveSim } from './HeroVariantInteractiveSim';

export type HeroVariantType = 'connected-hub' | 'interactive-sim';

interface HeroSectionOrganicProps {
  variant?: HeroVariantType;
  onGetStarted?: () => void;
  onBookDemo?: () => void;
}

export function HeroSectionOrganic({
  variant = 'connected-hub',
  onGetStarted,
  onBookDemo,
}: HeroSectionOrganicProps) {
  if (variant === 'interactive-sim') {
    return <HeroVariantInteractiveSim onGetStarted={onGetStarted} onViewDocs={onBookDemo} />;
  }

  return <HeroVariantConnectedHub onGetStarted={onGetStarted} onBookDemo={onBookDemo} />;
}
