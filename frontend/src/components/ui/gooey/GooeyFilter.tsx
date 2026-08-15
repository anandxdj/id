'use client';

import React from 'react';

interface GooeyFilterProps {
  id?: string;
  strength?: 'subtle' | 'standard' | 'intense';
}

export function GooeyFilter({ id = 'gooey', strength = 'standard' }: GooeyFilterProps) {
  const configs = {
    subtle: { blur: 6, alphaMultiplier: 15, alphaOffset: -7 },
    standard: { blur: 10, alphaMultiplier: 20, alphaOffset: -10 },
    intense: { blur: 16, alphaMultiplier: 26, alphaOffset: -12 },
  };

  const { blur, alphaMultiplier, alphaOffset } = configs[strength];

  return (
    <svg
      className="pointer-events-none fixed inset-0 -z-50 size-0 overflow-hidden opacity-0"
      aria-hidden="true"
    >
      <defs>
        <filter id={id} colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values={`1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${alphaMultiplier} ${alphaOffset}`}
            result="gooey"
          />
          <feComposite in="SourceGraphic" in2="gooey" operator="atop" />
        </filter>

        <filter id="gooey-raw" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values={`1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${alphaMultiplier} ${alphaOffset}`}
          />
        </filter>

        <filter id="gooey-subtle" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 16 -8"
            result="gooey"
          />
          <feComposite in="SourceGraphic" in2="gooey" operator="atop" />
        </filter>

        <filter id="gooey-intense" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="15" result="blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 25 -11"
            result="gooey"
          />
          <feComposite in="SourceGraphic" in2="gooey" operator="atop" />
        </filter>
      </defs>
    </svg>
  );
}
