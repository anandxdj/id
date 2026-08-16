'use client';

/**
 * High-fidelity Organic Fluid Landing Page Showcase matching the design reference.
 * Pure black canvas with organic white blob islands, 3D clay graphics, and connecting conduits.
 */

import React from 'react';
import {
  OrganicNavbar,
  HeroVariantConnectedHub,
  CorePillarsOrganic,
  AppsConsoleOrganic,
  MidValueBanner,
  SecurityPrivacyOrganic,
  TestimonialCarouselOrganic,
  CtaBannerOrganic,
  FooterOrganic,
} from '@/features/organic-landing';

export default function PreviewPage() {
  return (
    <div className="relative min-h-screen bg-background text-foreground font-sans overflow-x-clip transition-colors duration-300">
      {/* Top Header Navigation */}
      <OrganicNavbar />

      {/* Main Page Flow */}
      <main className="relative z-10 pb-4 space-y-2 sm:space-y-3">
        {/* 1. Hero Section: Left Organic Blob Card + Right 3D ID Hub with Connected Nodes */}
        <HeroVariantConnectedHub />

        {/* 2. Core Pillars Row */}
        <CorePillarsOrganic />

        {/* 3. All-in-One Apps Console Section */}
        <AppsConsoleOrganic />

        {/* 4. Mid Value Banner: Built for developers. Loved by users. */}
        <MidValueBanner />

        {/* 5. Security, Privacy & Performance Section with 3D Clay Lock */}
        <SecurityPrivacyOrganic />

        {/* 6. Testimonials 3-Card Organic Morphing Carousel */}
        <TestimonialCarouselOrganic />

        {/* 7. Ready to take control CTA Banner with 3D Clay Blob */}
        <CtaBannerOrganic />

        {/* Footer */}
        <FooterOrganic />
      </main>
    </div>
  );
}
