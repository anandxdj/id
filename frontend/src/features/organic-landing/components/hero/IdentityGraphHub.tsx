'use client';

import React from 'react';
import { Shield, Zap, CheckCircle2, User } from 'lucide-react';
import { ClayHub3D } from '../common/ClayHub3D';

export function IdentityGraphHub() {
  return (
    <div className="relative w-full max-w-[580px] h-[460px] sm:h-[480px] mx-auto flex items-center justify-center select-none">
      {/* SVG Connecting Conduits Layer (Dotted Lines) */}
      <svg
        className="absolute inset-0 size-full pointer-events-none z-0"
        viewBox="0 0 580 480"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Top-Left: Secure Card -> Hub Top-Left Lobe */}
        <path
          d="M 160 45 C 230 45, 180 160, 220 200"
          stroke="#71717a"
          strokeWidth="2"
          strokeDasharray="4 6"
        />
        {/* Top-Right: Fast Card -> Hub Top-Right Lobe */}
        <path
          d="M 420 45 C 350 45, 400 160, 360 200"
          stroke="#71717a"
          strokeWidth="2"
          strokeDasharray="4 6"
        />
        {/* Bottom-Left: Reliable Card -> Hub Bottom-Left Lobe */}
        <path
          d="M 160 435 C 230 435, 180 320, 220 280"
          stroke="#71717a"
          strokeWidth="2"
          strokeDasharray="4 6"
        />
        {/* Bottom-Right: Ownership Card -> Hub Bottom-Right Lobe */}
        <path
          d="M 420 435 C 350 435, 400 320, 360 280"
          stroke="#71717a"
          strokeWidth="2"
          strokeDasharray="4 6"
        />
      </svg>

      {/* Central 4-Lobed 3D Clay ID Hub */}
      <div className="relative z-10">
        <ClayHub3D label="OID" />
      </div>

      {/* Top-Left Card: Secure */}
      <div className="absolute top-4 left-0 sm:left-4 z-20 flex items-center gap-3.5 px-5 py-3 rounded-2xl bg-white text-zinc-950 shadow-2xl border border-zinc-100/80 cursor-pointer hover:scale-105 transition-transform">
        <div className="size-9 rounded-xl bg-zinc-100 flex items-center justify-center shrink-0 text-zinc-950">
          <Shield className="size-4.5 stroke-[2]" />
        </div>
        <div>
          <p className="text-xs sm:text-[13px] font-bold leading-tight text-zinc-950">Secure</p>
          <p className="text-[10.5px] text-zinc-500 font-medium leading-tight mt-0.5">
            Industry standard security
          </p>
        </div>
      </div>

      {/* Top-Right Card: Fast */}
      <div className="absolute top-4 right-0 sm:right-4 z-20 flex items-center gap-3.5 px-5 py-3 rounded-2xl bg-white text-zinc-950 shadow-2xl border border-zinc-100/80 cursor-pointer hover:scale-105 transition-transform">
        <div className="size-9 rounded-xl bg-zinc-100 flex items-center justify-center shrink-0 text-zinc-950">
          <Zap className="size-4.5 stroke-[2]" />
        </div>
        <div>
          <p className="text-xs sm:text-[13px] font-bold leading-tight text-zinc-950">Fast</p>
          <p className="text-[10.5px] text-zinc-500 font-medium leading-tight mt-0.5">
            Built for performance
          </p>
        </div>
      </div>

      {/* Bottom-Left Card: Reliable */}
      <div className="absolute bottom-4 left-0 sm:left-4 z-20 flex items-center gap-3.5 px-5 py-3 rounded-2xl bg-white text-zinc-950 shadow-2xl border border-zinc-100/80 cursor-pointer hover:scale-105 transition-transform">
        <div className="size-9 rounded-xl bg-zinc-100 flex items-center justify-center shrink-0 text-zinc-950">
          <CheckCircle2 className="size-4.5 stroke-[2]" />
        </div>
        <div>
          <p className="text-xs sm:text-[13px] font-bold leading-tight text-zinc-950">Reliable</p>
          <p className="text-[10.5px] text-zinc-500 font-medium leading-tight mt-0.5">
            99.99% uptime you can trust
          </p>
        </div>
      </div>

      {/* Bottom-Right Card: You own your data */}
      <div className="absolute bottom-4 right-0 sm:right-4 z-20 flex items-center gap-3.5 px-5 py-3 rounded-2xl bg-white text-zinc-950 shadow-2xl border border-zinc-100/80 cursor-pointer hover:scale-105 transition-transform">
        <div className="size-9 rounded-xl bg-zinc-100 flex items-center justify-center shrink-0 text-zinc-950">
          <User className="size-4.5 stroke-[2]" />
        </div>
        <div>
          <p className="text-xs sm:text-[13px] font-bold leading-tight text-zinc-950">You own your data</p>
          <p className="text-[10.5px] text-zinc-500 font-medium leading-tight mt-0.5">
            Users can export or delete anytime
          </p>
        </div>
      </div>
    </div>
  );
}



