'use client';

import React from 'react';
import {
  FigmaNavbar,
  FigmaHero,
  FigmaCorePillars,
  FigmaAppsConsole,
  FigmaMidBanner,
  FigmaSecurityPrivacy,
  FigmaTestimonials,
  FigmaCtaBanner,
  FigmaFooter,
} from '@/features/figma-design';

export default function DesignPage() {
  return (
    <div className="relative min-h-screen bg-black text-white font-sans overflow-x-hidden selection:bg-white selection:text-black">
      {/* 1. Header Navigation Bar */}
      <FigmaNavbar />

      {/* Main Content Layout */}
      <main className="relative z-10 space-y-4 sm:space-y-6 pb-6">
        {/* 2. Hero Section: Left Organic Blob Card + Right Connected Hub */}
        <FigmaHero />

        {/* 3. 5 Core Pillars Row */}
        <FigmaCorePillars />

        {/* 4. One Account. Access All Your Applications (Console Grid) */}
        <FigmaAppsConsole />

        {/* 5. Mid Value Banner: Built by developers. Trusted by teams */}
        <FigmaMidBanner />

        {/* 6. Security. Privacy. Performance. with 3D Lock */}
        <FigmaSecurityPrivacy />

        {/* 7. Testimonials Carousel */}
        <FigmaTestimonials />

        {/* 8. Ready to take control of your identity? CTA Banner */}
        <FigmaCtaBanner />

        {/* 9. Footer */}
        <FigmaFooter />
      </main>
    </div>
  );
}
