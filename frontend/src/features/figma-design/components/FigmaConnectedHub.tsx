'use client';

import React from 'react';
import { Shield, Zap, Box, User, Database } from 'lucide-react';

/**
 * 3D Clay Morphing Starfish Hub with central OID badge
 * and 5 connected satellite cards matching the Figma design.
 */
export function FigmaConnectedHub() {
  return (
    <div className="relative w-full max-w-[580px] h-[480px] sm:h-[500px] mx-auto flex items-center justify-center select-none">
      {/* SVG Connecting Conduits Layer (Dashed lines to satellite cards) */}
      <svg
        className="absolute inset-0 size-full pointer-events-none z-0"
        viewBox="0 0 580 500"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Top-Left: Secure Card -> Central Hub */}
        <path
          d="M 170 65 C 240 65, 200 170, 240 210"
          stroke="#52525b"
          strokeWidth="1.5"
          strokeDasharray="4 6"
        />
        {/* Top-Right: Fast Card -> Central Hub */}
        <path
          d="M 410 65 C 340 65, 380 170, 340 210"
          stroke="#52525b"
          strokeWidth="1.5"
          strokeDasharray="4 6"
        />
        {/* Bottom-Left: Open Standards Card -> Central Hub */}
        <path
          d="M 170 425 C 240 425, 200 330, 240 290"
          stroke="#52525b"
          strokeWidth="1.5"
          strokeDasharray="4 6"
        />
        {/* Bottom-Right: User Data Ownership Card -> Central Hub */}
        <path
          d="M 410 425 C 340 425, 380 330, 340 290"
          stroke="#52525b"
          strokeWidth="1.5"
          strokeDasharray="4 6"
        />
        {/* Center Bottom: Reliable Pill -> Central Hub */}
        <path
          d="M 290 440 L 290 350"
          stroke="#52525b"
          strokeWidth="1.5"
          strokeDasharray="4 6"
        />
      </svg>

      {/* Central 3D Organic Clay Blob Hub */}
      <div className="relative z-10 flex items-center justify-center size-[320px] sm:size-[360px] md:size-[380px]">
        {/* Soft Ambient Floor Shadow */}
        <div
          className="absolute inset-x-6 bottom-2 h-20 rounded-full bg-black/90 blur-3xl -z-10"
          style={{ transform: 'scale(0.85, 0.4)' }}
        />

        {/* Volumetric Clay Blob SVG */}
        <svg
          viewBox="0 0 400 400"
          className="size-full filter drop-shadow-[0_25px_35px_rgba(0,0,0,0.6)] transition-transform duration-500 hover:scale-[1.02]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Volumetric Clay Gradient */}
            <radialGradient
              id="hubClayGrad"
              cx="40%"
              cy="35%"
              r="65%"
              fx="35%"
              fy="28%"
            >
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="35%" stopColor="#F8F8FA" />
              <stop offset="65%" stopColor="#E4E4E8" />
              <stop offset="88%" stopColor="#CBCBD2" />
              <stop offset="100%" stopColor="#A8A8B2" />
            </radialGradient>

            {/* Specular Highlight */}
            <radialGradient id="hubSpecGlint" cx="30%" cy="22%" r="28%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
              <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </radialGradient>

            {/* Clay Bevel Crease Shadow */}
            <linearGradient id="hubCreaseShadow" x1="50%" y1="20%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="transparent" />
              <stop offset="60%" stopColor="rgba(0,0,0,0.02)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0.25)" />
            </linearGradient>
          </defs>

          {/* Organic Morphing 4-Lobed Clay Base */}
          <path
            d="M 200 40
               C 260 40, 310 70, 340 120
               C 370 170, 370 230, 330 280
               C 290 330, 260 360, 200 360
               C 140 360, 110 330, 70 280
               C 30 230, 30 170, 60 120
               C 90 70, 140 40, 200 40 Z"
            fill="url(#hubClayGrad)"
          />

          {/* 4 Organic Satellite Lobes */}
          <circle cx="290" cy="110" r="75" fill="url(#hubClayGrad)" />
          <circle cx="110" cy="120" r="75" fill="url(#hubClayGrad)" />
          <circle cx="120" cy="270" r="72" fill="url(#hubClayGrad)" />
          <circle cx="280" cy="270" r="72" fill="url(#hubClayGrad)" />
          <circle cx="200" cy="200" r="110" fill="url(#hubClayGrad)" />

          {/* Shadow Overlay */}
          <circle cx="200" cy="200" r="140" fill="url(#hubCreaseShadow)" />

          {/* Highlight Specular */}
          <ellipse
            cx="170"
            cy="140"
            rx="75"
            ry="40"
            fill="url(#hubSpecGlint)"
            transform="rotate(-15 170 140)"
          />
        </svg>

        {/* Central Black Circular OID Badge */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="size-24 sm:size-28 rounded-full bg-black text-white flex items-center justify-center shadow-[inset_0_2px_4px_rgba(255,255,255,0.3),0_15px_30px_rgba(0,0,0,0.8)] border border-white/10">
            <span className="font-heading font-black text-2xl sm:text-3xl tracking-tight">
              OID
            </span>
          </div>
        </div>
      </div>

      {/* Top-Left Card: Secure */}
      <div className="absolute top-2 left-0 sm:left-2 z-20 flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white text-zinc-950 shadow-2xl border border-zinc-200/80 cursor-pointer hover:scale-105 transition-all max-w-[210px]">
        <div className="size-8 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center shrink-0 text-zinc-950">
          <Shield className="size-4 stroke-[2]" />
        </div>
        <div>
          <p className="text-xs font-bold leading-tight text-zinc-950">Secure</p>
          <p className="text-[10px] text-zinc-500 font-normal leading-tight mt-0.5">
            Enterprise-grade security and encryption.
          </p>
        </div>
      </div>

      {/* Top-Right Card: Fast */}
      <div className="absolute top-2 right-0 sm:right-2 z-20 flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white text-zinc-950 shadow-2xl border border-zinc-200/80 cursor-pointer hover:scale-105 transition-all max-w-[210px]">
        <div className="size-8 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center shrink-0 text-zinc-950">
          <Zap className="size-4 stroke-[2]" />
        </div>
        <div>
          <p className="text-xs font-bold leading-tight text-zinc-950">Fast</p>
          <p className="text-[10px] text-zinc-500 font-normal leading-tight mt-0.5">
            Optimized for speed and reliability.
          </p>
        </div>
      </div>

      {/* Bottom-Left Card: Open Standards */}
      <div className="absolute bottom-2 left-0 sm:left-2 z-20 flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white text-zinc-950 shadow-2xl border border-zinc-200/80 cursor-pointer hover:scale-105 transition-all max-w-[220px]">
        <div className="size-8 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center shrink-0 text-zinc-950">
          <Box className="size-4 stroke-[2]" />
        </div>
        <div>
          <p className="text-xs font-bold leading-tight text-zinc-950">Open Standards</p>
          <p className="text-[10px] text-zinc-500 font-normal leading-tight mt-0.5">
            Full OpenID Connect & OAuth 2.1 compliance.
          </p>
        </div>
      </div>

      {/* Bottom-Right Card: User Data Ownership */}
      <div className="absolute bottom-2 right-0 sm:right-2 z-20 flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white text-zinc-950 shadow-2xl border border-zinc-200/80 cursor-pointer hover:scale-105 transition-all max-w-[220px]">
        <div className="size-8 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center shrink-0 text-zinc-950">
          <User className="size-4 stroke-[2]" />
        </div>
        <div>
          <p className="text-xs font-bold leading-tight text-zinc-950">User Data Ownership</p>
          <p className="text-[10px] text-zinc-500 font-normal leading-tight mt-0.5">
            Your data, your rules. No vendor lock-in.
          </p>
        </div>
      </div>

      {/* Center Bottom Pill Card: Reliable */}
      <div className="absolute bottom-0 z-20 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white text-zinc-950 shadow-xl border border-zinc-200 cursor-pointer hover:scale-105 transition-all">
        <Database className="size-3.5 text-zinc-950" />
        <span className="text-[10.5px] font-bold text-zinc-950">Reliable</span>
        <span className="text-[10px] text-zinc-500 font-normal">• Built to scale with your architecture.</span>
      </div>
    </div>
  );
}
