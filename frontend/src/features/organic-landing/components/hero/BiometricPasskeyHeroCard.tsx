'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  Zap,
  Fingerprint,
  Lock,
  Unlock,
  CheckCircle2,
  KeyRound,
  RotateCcw,
  Sparkles,
  Smartphone,
  Cpu,
  Radio,
  Check,
} from 'lucide-react';

type ProfileType = 'personal' | 'enterprise';
type AuthState = 'locked' | 'scanning' | 'authenticated';

export function BiometricPasskeyHeroCard() {
  const [profile, setProfile] = useState<ProfileType>('personal');
  const [authState, setAuthState] = useState<AuthState>('locked');

  const handleAuthenticate = () => {
    if (authState === 'authenticated') return;
    setAuthState('scanning');
    setTimeout(() => {
      setAuthState('authenticated');
    }, 700);
  };

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAuthState('locked');
  };

  return (
    <div className="relative w-full max-w-[580px] mx-auto py-6 px-2 sm:px-4 select-none">
      {/* 1. FLOATING AMBIENT TRUST PILLS (4 Nodes around Card) */}
      
      {/* Top-Left Pill */}
      <motion.div
        animate={{ y: [-4, 4, -4] }}
        transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
        className="absolute -top-1 left-2 sm:-left-4 z-30 flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/90 border border-zinc-700/80 shadow-[0_8px_20px_rgba(0,0,0,0.8)] backdrop-blur-md"
      >
        <ShieldCheck className="size-3.5 text-emerald-400" />
        <span className="text-[10.5px] sm:text-[11px] font-mono font-bold text-zinc-200 tracking-wide">
          FIDO2 Level 3
        </span>
      </motion.div>

      {/* Top-Right Pill */}
      <motion.div
        animate={{ y: [4, -4, 4] }}
        transition={{ repeat: Infinity, duration: 4.5, ease: 'easeInOut' }}
        className="absolute -top-1 right-2 sm:-right-4 z-30 flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/90 border border-zinc-700/80 shadow-[0_8px_20px_rgba(0,0,0,0.8)] backdrop-blur-md"
      >
        <Zap className="size-3.5 text-amber-400" />
        <span className="text-[10.5px] sm:text-[11px] font-mono font-bold text-zinc-200 tracking-wide">
          &lt;1ms Biometric Auth
        </span>
      </motion.div>

      {/* Bottom-Left Pill */}
      <motion.div
        animate={{ y: [3, -3, 3] }}
        transition={{ repeat: Infinity, duration: 3.8, ease: 'easeInOut' }}
        className="absolute -bottom-2 left-2 sm:-left-3 z-30 flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/90 border border-zinc-700/80 shadow-[0_8px_20px_rgba(0,0,0,0.8)] backdrop-blur-md"
      >
        <Lock className="size-3.5 text-cyan-400" />
        <span className="text-[10.5px] sm:text-[11px] font-mono font-bold text-zinc-200 tracking-wide">
          Secure Enclave Bound
        </span>
      </motion.div>

      {/* Bottom-Right Pill */}
      <motion.div
        animate={{ y: [-3, 3, -3] }}
        transition={{ repeat: Infinity, duration: 4.2, ease: 'easeInOut' }}
        className="absolute -bottom-2 right-2 sm:-right-3 z-30 flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/90 border border-zinc-700/80 shadow-[0_8px_20px_rgba(0,0,0,0.8)] backdrop-blur-md"
      >
        <Cpu className="size-3.5 text-purple-400" />
        <span className="text-[10.5px] sm:text-[11px] font-mono font-bold text-zinc-200 tracking-wide">
          Zero-Knowledge Crypto
        </span>
      </motion.div>

      {/* 2. MAIN DEEP OBSIDIAN GLASS PASSKEY CARD */}
      <div className="relative rounded-[2.2rem] bg-gradient-to-b from-zinc-900/90 via-zinc-950/95 to-black border border-zinc-800/90 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95),0_0_0_1px_rgba(255,255,255,0.08)] p-6 sm:p-8 backdrop-blur-2xl overflow-hidden transition-all duration-300 hover:border-zinc-700/90">
        {/* Holographic Border Sheen Layer */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-zinc-400/40 to-transparent pointer-events-none" />
        
        {/* Ambient Radial Highlights */}
        <div className="absolute -top-16 -right-16 size-48 bg-zinc-800/25 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 size-48 bg-zinc-700/20 rounded-full blur-3xl pointer-events-none" />

        {/* Card Header: Metallic Smart Chip + Profile Switcher */}
        <div className="flex items-center justify-between gap-4 pb-5 border-b border-zinc-800/80">
          {/* Smart Chip Visual */}
          <div className="flex items-center gap-3">
            <div className="relative size-10 rounded-lg bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 p-[1.5px] shadow-md">
              <div className="size-full rounded-[6px] bg-zinc-950 flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-[2px] p-1 opacity-70">
                  <div className="border-r border-b border-amber-400/60 rounded-tl-sm" />
                  <div className="border-l border-b border-amber-400/60 rounded-tr-sm" />
                  <div className="border-r border-t border-amber-400/60 rounded-bl-sm" />
                  <div className="border-l border-t border-amber-400/60 rounded-br-sm" />
                </div>
                <div className="size-3 rounded-full bg-amber-400/30 border border-amber-300/80 z-10" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-mono font-extrabold uppercase tracking-widest text-zinc-100">
                  OID Passkey
                </span>
                <Radio className="size-3 text-zinc-500 animate-pulse" />
              </div>
              <span className="text-[9.5px] font-mono text-zinc-500 block">
                WebAuthn • CTAP2 Strict
              </span>
            </div>
          </div>

          {/* Profile Switcher Pills */}
          <div className="flex items-center rounded-xl bg-zinc-900/90 p-1 border border-zinc-800">
            <button
              type="button"
              onClick={() => setProfile('personal')}
              className={`px-3 py-1 rounded-lg text-xs font-mono transition-all ${
                profile === 'personal'
                  ? 'bg-zinc-800 text-white font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Personal
            </button>
            <button
              type="button"
              onClick={() => setProfile('enterprise')}
              className={`px-3 py-1 rounded-lg text-xs font-mono transition-all ${
                profile === 'enterprise'
                  ? 'bg-zinc-800 text-white font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Work ID
            </button>
          </div>
        </div>

        {/* Card Body: Interactive Biometric Stage */}
        <div className="py-6">
          <AnimatePresence mode="wait">
            {authState === 'locked' && (
              <motion.div
                key="locked-state"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.2 }}
                onClick={handleAuthenticate}
                className="cursor-pointer group flex flex-col items-center justify-center p-6 rounded-2xl bg-zinc-900/40 border border-dashed border-zinc-800 hover:border-zinc-600/80 hover:bg-zinc-900/70 transition-all duration-300 text-center"
              >
                {/* Touch ID Icon with breathing glow ring */}
                <div className="relative mb-4">
                  <div className="absolute inset-0 rounded-full bg-emerald-500/10 blur-xl group-hover:bg-emerald-500/25 transition-all duration-500 scale-150" />
                  <div className="size-20 sm:size-22 rounded-2xl bg-gradient-to-b from-zinc-800 to-zinc-900 border border-zinc-700/80 flex items-center justify-center shadow-2xl group-hover:scale-105 group-hover:border-zinc-500 transition-all duration-300">
                    <Fingerprint className="size-10 sm:size-11 text-zinc-300 group-hover:text-emerald-400 transition-colors duration-300" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 size-6 rounded-full bg-zinc-950 border border-zinc-700 flex items-center justify-center text-zinc-400 group-hover:text-white">
                    <Lock className="size-3" />
                  </div>
                </div>

                <p className="text-sm font-semibold text-white group-hover:text-emerald-300 transition-colors">
                  Tap to Authenticate with Passkey
                </p>
                <p className="text-xs text-zinc-400 font-sans mt-1 max-w-[280px]">
                  Hardware-backed biometric handshake via Touch ID, Face ID, or Security Key.
                </p>

                {/* Masked Hash Line */}
                <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/60 border border-zinc-800 font-mono text-[10px] text-zinc-500">
                  <span>KEY_SLOT:</span>
                  <span className="text-zinc-300 font-bold tracking-widest">•••• •••• •••• 9F42</span>
                </div>
              </motion.div>
            )}

            {authState === 'scanning' && (
              <motion.div
                key="scanning-state"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col items-center justify-center p-8 rounded-2xl bg-zinc-900/60 border border-zinc-700/90 text-center"
              >
                <div className="relative mb-4">
                  <div className="size-20 rounded-2xl bg-zinc-900 border border-emerald-500/80 flex items-center justify-center relative overflow-hidden shadow-[0_0_25px_rgba(16,185,129,0.35)]">
                    <Fingerprint className="size-10 text-emerald-400" />
                    {/* Laser scan line animation */}
                    <motion.div
                      animate={{ y: [-30, 30, -30] }}
                      transition={{ repeat: Infinity, duration: 0.6, ease: 'linear' }}
                      className="absolute inset-x-0 h-0.5 bg-emerald-300 shadow-[0_0_8px_rgba(52,211,153,1)]"
                    />
                  </div>
                </div>

                <p className="text-sm font-bold text-emerald-400 font-mono">
                  VERIFYING HARDWARE PASSKEY...
                </p>
                <p className="text-xs text-zinc-400 font-sans mt-1">
                  Querying Apple / Android Secure Enclave in &lt;1ms
                </p>
              </motion.div>
            )}

            {authState === 'authenticated' && (
              <motion.div
                key="authenticated-state"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                {/* Verified Identity Profile Card */}
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-zinc-900/90 to-zinc-900/50 border border-emerald-500/40 shadow-[0_0_25px_rgba(16,185,129,0.15)] flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    {/* Avatar */}
                    <div className="relative">
                      <div className="size-12 rounded-full bg-gradient-to-tr from-emerald-500 to-cyan-500 p-[2px] shadow-lg">
                        <div className="size-full rounded-full bg-zinc-950 flex items-center justify-center font-heading font-black text-sm text-white">
                          {profile === 'personal' ? 'AR' : 'SC'}
                        </div>
                      </div>
                      <div className="absolute -bottom-1 -right-1 size-5 rounded-full bg-emerald-500 text-zinc-950 flex items-center justify-center shadow-md">
                        <Check className="size-3 stroke-[3]" />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-heading text-sm sm:text-[15px] font-bold text-white">
                          {profile === 'personal' ? 'Alex Rivera' : 'Sarah Chen (Admin)'}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[9.5px] font-mono font-bold">
                          VERIFIED
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 font-mono mt-0.5">
                        {profile === 'personal' ? 'alex@oid.local' : 'sarah@acme.corp'}
                      </p>
                    </div>
                  </div>

                  {/* Re-lock Button */}
                  <button
                    type="button"
                    onClick={handleReset}
                    title="Lock session"
                    className="p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="size-4" />
                  </button>
                </div>

                {/* Cryptographic Key Details Matrix */}
                <div className="grid grid-cols-2 gap-2.5 text-[11px] font-mono">
                  <div className="p-2.5 rounded-xl bg-black/60 border border-zinc-800">
                    <span className="text-zinc-500 block text-[9.5px]">ALGORITHM</span>
                    <span className="text-zinc-200 font-bold">ECDSA P-256 (RS256)</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/60 border border-zinc-800">
                    <span className="text-zinc-500 block text-[9.5px]">SECURITY ENCLAVE</span>
                    <span className="text-emerald-400 font-bold">Hardware-Backed ✓</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-black/60 border border-zinc-800 col-span-2 flex items-center justify-between">
                    <div>
                      <span className="text-zinc-500 block text-[9.5px]">KEY THUMBPRINT</span>
                      <span className="text-cyan-300 font-bold">
                        0x7F2A:B9C1:44E0:88D3:19A4
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-400 bg-zinc-900 px-2 py-1 rounded border border-zinc-800">
                      Active Session
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Card Footer: Metadata Bar */}
        <div className="pt-4 border-t border-zinc-800/80 flex items-center justify-between text-[10.5px] font-mono text-zinc-400">
          <div className="flex items-center gap-1.5">
            <Sparkles className="size-3 text-zinc-500" />
            <span>Zero Password Architecture</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            <span className="text-zinc-300">Sovereign Identity Engine</span>
          </div>
        </div>
      </div>
    </div>
  );
}
