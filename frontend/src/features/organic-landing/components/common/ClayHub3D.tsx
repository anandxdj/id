'use client';

import React from 'react';

/**
 * Photorealistic 4-Lobed 3D Puffy Clay Starfish Hub matching the reference image.
 * Features 4 distinct organic bulbous lobes with soft ambient occlusion,
 * volumetric highlights, and central black core badge.
 */

export function ClayHub3D({ label = 'ID' }: { label?: string }) {
  return (
    <div className="relative flex items-center justify-center size-[460px] sm:size-[540px] md:size-[580px] select-none">
      {/* Soft Ambient Floor Shadow */}
      <div
        className="absolute inset-x-8 bottom-4 h-24 rounded-full bg-black/85 blur-3xl -z-10"
        style={{ transform: 'scale(0.85, 0.45)' }}
      />

      {/* SVG 4-Lobed Volumetric Clay Starfish */}
      <svg
        viewBox="0 0 500 500"
        className="size-full filter drop-shadow-[0_25px_40px_rgba(0,0,0,0.6)] transition-transform duration-500 hover:scale-[1.03]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Main Volumetric Radial Gradient (Light source from top-left) */}
          <radialGradient
            id="clayCoreGradient"
            cx="42%"
            cy="36%"
            r="65%"
            fx="38%"
            fy="30%"
          >
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="35%" stopColor="#F8F8FA" />
            <stop offset="65%" stopColor="#E4E4E8" />
            <stop offset="88%" stopColor="#CBCBD2" />
            <stop offset="100%" stopColor="#A8A8B2" />
          </radialGradient>

          {/* Top Specular Glint */}
          <radialGradient id="hubSpecular" cx="30%" cy="22%" r="28%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>

          {/* Under-Lobe Crease Shadows */}
          <linearGradient id="hubUnderShadow" x1="50%" y1="20%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="60%" stopColor="rgba(0,0,0,0.02)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.22)" />
          </linearGradient>
        </defs>

        {/* 4 Distinct Volumetric Bulges (Top-Left, Top-Right, Bottom-Left, Bottom-Right) */}
        <path
          d="M 250 50
             C 320 50, 370 90, 410 150
             C 450 210, 440 280, 390 340
             C 340 400, 300 440, 240 445
             C 180 450, 130 400, 85 340
             C 40 280, 45 200, 85 140
             C 125 80, 180 50, 250 50 Z"
          fill="url(#clayCoreGradient)"
        />

        {/* 4 Organic Satellite Lobes creating the Cross Starfish shape */}
        {/* Top-Right Lobe */}
        <circle cx="350" cy="150" r="95" fill="url(#clayCoreGradient)" />
        {/* Top-Left Lobe */}
        <circle cx="160" cy="160" r="95" fill="url(#clayCoreGradient)" />
        {/* Bottom-Left Lobe */}
        <circle cx="170" cy="330" r="90" fill="url(#clayCoreGradient)" />
        {/* Bottom-Right Lobe */}
        <circle cx="330" cy="330" r="90" fill="url(#clayCoreGradient)" />
        {/* Central Connecting Mass */}
        <circle cx="250" cy="250" r="130" fill="url(#clayCoreGradient)" />

        {/* Shadow Layer for Depth */}
        <circle cx="250" cy="250" r="170" fill="url(#hubUnderShadow)" />

        {/* Highlights */}
        <ellipse cx="210" cy="180" rx="90" ry="50" fill="url(#hubSpecular)" transform="rotate(-15 210 180)" />
      </svg>

      {/* Central Black Circular ID Lens */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="size-28 sm:size-32 rounded-full bg-black text-white flex items-center justify-center shadow-[inset_0_2px_5px_rgba(255,255,255,0.25),0_15px_30px_rgba(0,0,0,0.7)]">
          <span className="font-heading font-black text-3xl sm:text-4xl tracking-tight">
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}
