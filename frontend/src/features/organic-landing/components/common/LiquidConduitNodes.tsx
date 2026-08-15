'use client';

import React from 'react';
import { Shield, Zap, Activity, UserCheck } from 'lucide-react';
import { ClayHub3D } from './ClayHub3D';

export function LiquidConduitNodes() {
  return (
    <div className="relative w-full max-w-[560px] h-[480px] sm:h-[540px] mx-auto flex items-center justify-center select-none">
      {/* SVG Connecting Dotted Curved Conduits */}
      <svg
        className="absolute inset-0 size-full pointer-events-none z-0"
        viewBox="0 0 560 540"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Top-Left Card to Clay Blob */}
        <path
          d="M 160 90 C 220 90, 220 230, 270 260"
          stroke="#404040"
          strokeWidth="2.5"
          strokeDasharray="4 6"
        />

        {/* Top-Right Card to Clay Blob */}
        <path
          d="M 400 90 C 340 90, 340 230, 290 260"
          stroke="#404040"
          strokeWidth="2.5"
          strokeDasharray="4 6"
        />

        {/* Bottom-Left Card to Clay Blob */}
        <path
          d="M 160 450 C 220 450, 220 310, 270 280"
          stroke="#404040"
          strokeWidth="2.5"
          strokeDasharray="4 6"
        />

        {/* Bottom-Right Card to Clay Blob */}
        <path
          d="M 400 450 C 340 450, 340 310, 290 280"
          stroke="#404040"
          strokeWidth="2.5"
          strokeDasharray="4 6"
        />
      </svg>

      {/* Central 4-Lobed 3D Clay Hub */}
      <div className="relative z-10">
        <ClayHub3D label="ID" />
      </div>

      {/* Top-Left Card: Secure */}
      <div className="absolute top-2 left-0 sm:left-2 z-20 flex items-center gap-3 px-4 py-3 rounded-2xl bg-white text-black shadow-2xl border border-zinc-200">
        <div className="size-8 rounded-xl bg-zinc-100 flex items-center justify-center shrink-0 text-black">
          <Shield className="size-4" />
        </div>
        <div>
          <p className="text-xs font-bold leading-tight">Secure</p>
          <p className="text-[10px] text-zinc-500 font-medium leading-tight">
            Industry standard security
          </p>
        </div>
      </div>

      {/* Top-Right Card: Fast */}
      <div className="absolute top-2 right-0 sm:right-2 z-20 flex items-center gap-3 px-4 py-3 rounded-2xl bg-white text-black shadow-2xl border border-zinc-200">
        <div className="size-8 rounded-xl bg-zinc-100 flex items-center justify-center shrink-0 text-black">
          <Zap className="size-4" />
        </div>
        <div>
          <p className="text-xs font-bold leading-tight">Fast</p>
          <p className="text-[10px] text-zinc-500 font-medium leading-tight">
            Built for performance
          </p>
        </div>
      </div>

      {/* Bottom-Left Card: Reliable */}
      <div className="absolute bottom-2 left-0 sm:left-2 z-20 flex items-center gap-3 px-4 py-3 rounded-2xl bg-white text-black shadow-2xl border border-zinc-200">
        <div className="size-8 rounded-xl bg-zinc-100 flex items-center justify-center shrink-0 text-black">
          <Activity className="size-4" />
        </div>
        <div>
          <p className="text-xs font-bold leading-tight">Reliable</p>
          <p className="text-[10px] text-zinc-500 font-medium leading-tight">
            99.99% uptime you can trust
          </p>
        </div>
      </div>

      {/* Bottom-Right Card: You own your data */}
      <div className="absolute bottom-2 right-0 sm:right-2 z-20 flex items-center gap-3 px-4 py-3 rounded-2xl bg-white text-black shadow-2xl border border-zinc-200">
        <div className="size-8 rounded-xl bg-zinc-100 flex items-center justify-center shrink-0 text-black">
          <UserCheck className="size-4" />
        </div>
        <div>
          <p className="text-xs font-bold leading-tight">You own your data</p>
          <p className="text-[10px] text-zinc-500 font-medium leading-tight">
            Users can export or delete anytime
          </p>
        </div>
      </div>
    </div>
  );
}
