'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface OrganicBlobSurfaceProps {
  children: React.ReactNode;
  className?: string;
  shape?: 'hero-left' | 'wide-island' | 'testimonial-1' | 'testimonial-2' | 'testimonial-3' | 'cta-banner';
  animate?: boolean;
}

/**
 * OrganicBlobSurface: Full-Bleed Organic Cushion with Maximum Interior Safe-Zone
 * The SVG path occupies ~96% of the 600x600 coordinate box, leaving vast interior
 * margin so text and controls NEVER touch or clip the edges.
 */
export function OrganicBlobSurface({
  children,
  className = '',
  shape = 'hero-left',
  animate = true,
}: OrganicBlobSurfaceProps) {
  // Full-Bleed 600x600 Bezier Cushion Paths
  const heroLeftCushionPaths = [
    // Morph State 1 (Generous, wide-open interior)
    `M 110 35
     C 200 20, 360 15, 480 20
     C 555 25, 590 100, 585 200
     C 580 290, 570 330, 565 390
     C 560 470, 585 520, 530 575
     C 450 595, 330 580, 240 580
     C 140 580, 80 590, 35 540
     C 10 480, 15 390, 18 300
     C 20 200, 15 110, 45 60
     C 65 30, 85 40, 110 35 Z`,

    // Morph State 2 (Gentle 12s breathing ripple)
    `M 115 30
     C 210 25, 350 12, 475 25
     C 550 35, 595 95, 590 210
     C 585 285, 565 335, 560 395
     C 555 475, 580 525, 525 580
     C 445 590, 325 585, 235 585
     C 135 585, 85 585, 40 535
     C 15 475, 20 385, 22 295
     C 25 195, 20 105, 50 55
     C 70 25, 90 35, 115 30 Z`,

    // Return to Morph State 1
    `M 110 35
     C 200 20, 360 15, 480 20
     C 555 25, 590 100, 585 200
     C 580 290, 570 330, 565 390
     C 560 470, 585 520, 530 575
     C 450 595, 330 580, 240 580
     C 140 580, 80 590, 35 540
     C 10 480, 15 390, 18 300
     C 20 200, 15 110, 45 60
     C 65 30, 85 40, 110 35 Z`,
  ];

  // Wide Continent Waves (Apps Console, Security Section)
  const wideIslandMorphPaths = [
    `M 70 40
     C 280 15, 560 45, 850 20
     C 1050 0, 1140 30, 1175 95
     C 1205 165, 1175 355, 1185 495
     C 1195 575, 1100 610, 950 600
     C 680 585, 420 620, 200 605
     C 70 595, 15 545, 10 425
     C 5 305, 25 155, 20 95
     C 15 55, 35 45, 70 40 Z`,

    `M 85 30
     C 300 30, 540 20, 870 35
     C 1070 20, 1130 45, 1185 85
     C 1195 175, 1185 345, 1175 505
     C 1185 585, 1080 600, 930 610
     C 660 615, 440 595, 180 610
     C 55 585, 25 535, 15 415
     C 10 295, 15 165, 30 85
     C 35 45, 55 35, 85 30 Z`,

    `M 70 40
     C 280 15, 560 45, 850 20
     C 1050 0, 1140 30, 1175 95
     C 1205 165, 1175 355, 1185 495
     C 1195 575, 1100 610, 950 600
     C 680 585, 420 620, 200 605
     C 70 595, 15 545, 10 425
     C 5 305, 25 155, 20 95
     C 15 55, 35 45, 70 40 Z`,
  ];

  return (
    <div className={`relative ${className}`}>
      {/* Living SVG Liquid Blob Layer */}
      <div className="absolute inset-0 size-full pointer-events-none">
        <svg
          className="size-full filter drop-shadow-[0_30px_60px_rgba(0,0,0,0.6)]"
          viewBox={shape === 'hero-left' ? '0 0 600 600' : '0 0 1200 640'}
          preserveAspectRatio="none"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {animate ? (
            <motion.path
              d={shape === 'hero-left' ? heroLeftCushionPaths[0] : wideIslandMorphPaths[0]}
              animate={{
                d: shape === 'hero-left' ? heroLeftCushionPaths : wideIslandMorphPaths,
              }}
              transition={{
                duration: 12,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              fill="#FFFFFF"
            />
          ) : (
            <path
              d={shape === 'hero-left' ? heroLeftCushionPaths[0] : wideIslandMorphPaths[0]}
              fill="#FFFFFF"
            />
          )}
        </svg>
      </div>

      {/* Safe Interior Content Layer */}
      <div className="relative z-10 size-full text-zinc-950 flex flex-col justify-between">
        {children}
      </div>
    </div>
  );
}
