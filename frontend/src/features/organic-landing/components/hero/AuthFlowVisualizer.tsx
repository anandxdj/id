'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  Zap,
  Play,
  Pause,
  RotateCcw,
  Copy,
  Check,
  Lock,
  Terminal,
  KeyRound,
  FileCheck2,
  ArrowRight,
  UserCheck,
  Server,
  Laptop,
  CheckCircle2,
  Cpu,
} from 'lucide-react';

type Persona = 'user' | 'admin';

interface StepData {
  id: number;
  label: string;
  shortTitle: string;
  badge: string;
  description: string;
}

const STEPS: StepData[] = [
  {
    id: 1,
    label: '01. Authorize & PKCE',
    shortTitle: 'Auth Request',
    badge: 'RFC 7636',
    description: 'Client generates cryptographic code_verifier and initiates authorization with SHA-256 challenge.',
  },
  {
    id: 2,
    label: '02. Verify Verifier',
    shortTitle: 'PKCE Handshake',
    badge: '< 6ms Execution',
    description: 'OID Identity Engine verifies code_verifier against code_challenge without storing plain secrets.',
  },
  {
    id: 3,
    label: '03. Issue RS256 Token',
    shortTitle: 'JWT Verified',
    badge: 'Signed RS256',
    description: 'Cryptographically signed asymmetric JWT issued with granular claims and instant validation.',
  },
];

export function AuthFlowVisualizer() {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [persona, setPersona] = useState<Persona>('user');
  const [copiedJwt, setCopiedJwt] = useState<boolean>(false);
  const [copiedRaw, setCopiedRaw] = useState<boolean>(false);

  // Auto-play timer cycle
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev % STEPS.length) + 1);
    }, 4200);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const rawJwtToken =
    persona === 'user'
      ? 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Im9pZC1rZXktMjAyNiJ9.eyJpc3MiOiJodHRwczovL2F1dGgub2lkLmxvY2FsIiwic3ViIjoidXNyXzk5YTgxMjMiLCJhdWQiOiJkZW1vLWFwcCIsIm5hbWUiOiJBbGV4IFJpdmVyYSIsImVtYWlsIjoiYWxleEBvaWQubG9jYWwiLCJyb2xlIjoidXNlciIsImV4cCI6MTc3NjUxODQwMCwiaWF0IjoxNzc2NDgyNDAwfQ.YmE5OTAyN2ExNjBjNDAwZGFkYmU'
      : 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Im9pZC1rZXktMjAyNiJ9.eyJpc3MiOiJodHRwczovL2F1dGgub2lkLmxvY2FsIiwic3ViIjoidXNyX2FkbWluXzc3OCIsImF1ZCI6ImRlbW8tYXBwIiwibmFtZSI6IlNhcmFoIENoZW4gKExlYWQpIiwiZW1haWwiOiJzYXJhaEBvaWQubG9jYWwiLCJyb2xlIjoiYWRtaW4iLCJzY29wZXMiOlsib2lkOmFkbWluIiwid3JpdGU6Y2xpZW50cyIsInJlYWQ6YXVkaXQiXSwiZXhwIjoxNzc2NTE4NDAwLCJpYXQiOjE3NzY0ODI0MDB9.VnN0MmFiNzZjYzc3NmE';

  const jwtPayload =
    persona === 'user'
      ? {
          iss: 'https://auth.oid.local',
          sub: 'usr_99a8123',
          aud: 'demo-app',
          name: 'Alex Rivera',
          email: 'alex@oid.local',
          role: 'user',
          exp: 1776518400,
          iat: 1776482400,
        }
      : {
          iss: 'https://auth.oid.local',
          sub: 'usr_admin_778',
          aud: 'demo-app',
          name: 'Sarah Chen (Lead)',
          email: 'sarah@oid.local',
          role: 'admin',
          scopes: ['oid:admin', 'write:clients', 'read:audit'],
          exp: 1776518400,
          iat: 1776482400,
        };

  const copyJwt = () => {
    navigator.clipboard.writeText(JSON.stringify(jwtPayload, null, 2));
    setCopiedJwt(true);
    setTimeout(() => setCopiedJwt(false), 2000);
  };

  const copyRaw = () => {
    navigator.clipboard.writeText(rawJwtToken);
    setCopiedRaw(true);
    setTimeout(() => setCopiedRaw(false), 2000);
  };

  return (
    <div className="w-full max-w-[660px] mx-auto select-none">
      {/* Outer Glow & Frosted Obsidian Shell */}
      <div className="relative rounded-[2rem] bg-zinc-950/95 border border-zinc-800/90 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.06)] p-5 sm:p-7 backdrop-blur-xl overflow-hidden">
        {/* Subtle Ambient Radial Lighting */}
        <div className="absolute top-0 right-1/4 w-80 h-40 bg-zinc-800/30 rounded-full blur-3xl pointer-events-none -z-10" />
        <div className="absolute bottom-0 left-1/4 w-80 h-40 bg-zinc-700/20 rounded-full blur-3xl pointer-events-none -z-10" />

        {/* Top Control Bar: Header & Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-2.5">
            <div className="size-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            <div>
              <span className="text-xs font-mono font-bold tracking-wide text-zinc-200">
                LIVE AUTH PROTOCOL
              </span>
              <span className="ml-2 text-[10px] font-mono px-2 py-0.5 rounded-md bg-zinc-900 text-zinc-400 border border-zinc-800">
                OAuth 2.1 Strict
              </span>
            </div>
          </div>

          {/* Right Controls: Persona toggle + Autoplay + Reset */}
          <div className="flex items-center gap-2">
            {/* Persona Switcher */}
            <div className="flex items-center rounded-lg bg-zinc-900/90 p-0.5 border border-zinc-800">
              <button
                type="button"
                onClick={() => setPersona('user')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-all ${
                  persona === 'user'
                    ? 'bg-zinc-800 text-white font-bold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                User
              </button>
              <button
                type="button"
                onClick={() => setPersona('admin')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-all ${
                  persona === 'admin'
                    ? 'bg-zinc-800 text-white font-bold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Admin
              </button>
            </div>

            {/* Play/Pause Button */}
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              title={isPlaying ? 'Pause simulation' : 'Play simulation'}
              className="size-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              {isPlaying ? <Pause className="size-3" /> : <Play className="size-3" />}
            </button>

            {/* Reset Button */}
            <button
              type="button"
              onClick={() => {
                setCurrentStep(1);
                setIsPlaying(true);
              }}
              title="Reset flow"
              className="size-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <RotateCcw className="size-3" />
            </button>
          </div>
        </div>

        {/* 3 Step Interactive Progress Pills */}
        <div className="grid grid-cols-3 gap-2 pt-4 pb-4">
          {STEPS.map((step) => {
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => {
                  setCurrentStep(step.id);
                  setIsPlaying(false);
                }}
                className={`relative group flex flex-col text-left p-2.5 sm:p-3 rounded-xl border transition-all duration-200 ${
                  isActive
                    ? 'bg-zinc-900/90 border-zinc-700 shadow-md ring-1 ring-zinc-700/50'
                    : isCompleted
                    ? 'bg-zinc-950/60 border-zinc-800/80 text-zinc-400 hover:border-zinc-700'
                    : 'bg-zinc-950/40 border-zinc-900 text-zinc-600 hover:border-zinc-800'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span
                    className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                      isActive
                        ? 'text-white'
                        : isCompleted
                        ? 'text-zinc-300'
                        : 'text-zinc-500'
                    }`}
                  >
                    {step.shortTitle}
                  </span>
                  {isCompleted ? (
                    <CheckCircle2 className="size-3 text-emerald-400" />
                  ) : isActive ? (
                    <span className="size-2 rounded-full bg-white animate-pulse" />
                  ) : (
                    <span className="size-1.5 rounded-full bg-zinc-700" />
                  )}
                </div>
                <span className="text-[10.5px] font-medium text-zinc-400 truncate hidden sm:block">
                  {step.badge}
                </span>

                {/* Active Underline Indicator */}
                {isActive && (
                  <motion.div
                    layoutId="activePillUnderline"
                    className="absolute bottom-0 inset-x-2 h-0.5 bg-gradient-to-r from-zinc-400 via-white to-zinc-400 rounded-full"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Network Pipeline Visual (Client <-> OID Hub <-> Protected App) */}
        <div className="relative my-3 p-3.5 sm:p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80">
          <div className="flex items-center justify-between relative z-10">
            {/* Node 1: Client App */}
            <div
              className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${
                currentStep >= 1 ? 'opacity-100' : 'opacity-40'
              }`}
            >
              <div
                className={`size-10 sm:size-11 rounded-xl flex items-center justify-center border transition-all ${
                  currentStep === 1
                    ? 'bg-white text-zinc-950 border-white shadow-[0_0_15px_rgba(255,255,255,0.4)] scale-105'
                    : 'bg-zinc-900 text-zinc-300 border-zinc-700'
                }`}
              >
                <Laptop className="size-5" />
              </div>
              <span className="text-[11px] font-mono font-semibold text-zinc-300">Client App</span>
              <span className="text-[9.5px] font-mono text-zinc-500">localhost:3000</span>
            </div>

            {/* Conduit 1 */}
            <div className="flex-1 px-2 flex flex-col items-center">
              <div className="w-full relative flex items-center justify-center">
                <div className="w-full h-0.5 bg-zinc-800" />
                {currentStep === 1 && (
                  <motion.div
                    animate={{ x: [-20, 20] }}
                    transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
                    className="absolute px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-950 text-[9px] font-mono font-bold shadow-md"
                  >
                    PKCE Init
                  </motion.div>
                )}
                {currentStep > 1 && (
                  <div className="absolute size-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                )}
              </div>
            </div>

            {/* Node 2: OID Identity Hub (Central) */}
            <div
              className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${
                currentStep >= 2 ? 'opacity-100' : 'opacity-60'
              }`}
            >
              <div
                className={`size-12 sm:size-13 rounded-2xl flex items-center justify-center border transition-all ${
                  currentStep === 2
                    ? 'bg-white text-zinc-950 border-white shadow-[0_0_20px_rgba(255,255,255,0.5)] scale-110'
                    : 'bg-zinc-900 text-white border-zinc-700'
                }`}
              >
                <ShieldCheck className="size-6" />
              </div>
              <span className="text-[11px] font-mono font-bold text-white">OID Server</span>
              <span className="text-[9.5px] font-mono text-emerald-400">auth.oid.local</span>
            </div>

            {/* Conduit 2 */}
            <div className="flex-1 px-2 flex flex-col items-center">
              <div className="w-full relative flex items-center justify-center">
                <div className="w-full h-0.5 bg-zinc-800" />
                {currentStep === 2 && (
                  <motion.div
                    animate={{ x: [-20, 20] }}
                    transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
                    className="absolute px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-950 text-[9px] font-mono font-bold shadow-md"
                  >
                    Verify S256
                  </motion.div>
                )}
                {currentStep === 3 && (
                  <motion.div
                    animate={{ x: [-20, 20] }}
                    transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
                    className="absolute px-2 py-0.5 rounded-full bg-emerald-400 text-zinc-950 text-[9px] font-mono font-bold shadow-md"
                  >
                    RS256 JWT
                  </motion.div>
                )}
              </div>
            </div>

            {/* Node 3: Protected Resource */}
            <div
              className={`flex flex-col items-center gap-1.5 transition-all duration-300 ${
                currentStep === 3 ? 'opacity-100' : 'opacity-40'
              }`}
            >
              <div
                className={`size-10 sm:size-11 rounded-xl flex items-center justify-center border transition-all ${
                  currentStep === 3
                    ? 'bg-emerald-400 text-zinc-950 border-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.5)] scale-105'
                    : 'bg-zinc-900 text-zinc-300 border-zinc-700'
                }`}
              >
                <Server className="size-5" />
              </div>
              <span className="text-[11px] font-mono font-semibold text-zinc-300">Protected API</span>
              <span className="text-[9.5px] font-mono text-zinc-500">api.internal</span>
            </div>
          </div>
        </div>

        {/* Dynamic Stage Content: Step Details & Code Inspector */}
        <div className="relative mt-3 rounded-2xl bg-zinc-900/90 border border-zinc-800/90 p-4 sm:p-5 overflow-hidden">
          <AnimatePresence mode="wait">
            {currentStep === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal className="size-4 text-zinc-400" />
                    <span className="text-xs font-mono font-bold text-zinc-200">
                      HTTP /oauth/v2/auth (PKCE Challenge)
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded border border-zinc-700">
                    GET Request
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-black/60 font-mono text-[11px] leading-relaxed text-zinc-300 border border-zinc-800/60 overflow-x-auto space-y-1">
                  <div>
                    <span className="text-zinc-500">response_type=</span>
                    <span className="text-emerald-400 font-bold">code</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">client_id=</span>
                    <span className="text-white">demo-app</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">scope=</span>
                    <span className="text-white">openid profile email</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">code_challenge_method=</span>
                    <span className="text-amber-400 font-bold">S256</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">code_challenge=</span>
                    <span className="text-cyan-400 break-all font-mono">
                      E9Melhoa2OwvFrGMTJguCH5...
                    </span>
                  </div>
                </div>

                <p className="text-[11.5px] text-zinc-400 font-sans">
                  The client generates a secret 128-byte verifier and exposes only its SHA-256 hash. Zero credentials in transit.
                </p>
              </motion.div>
            )}

            {currentStep === 2 && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="size-4 text-emerald-400" />
                    <span className="text-xs font-mono font-bold text-zinc-200">
                      Cryptographic Exchange Validation
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/60">
                    200 OK • 4.8ms
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-black/60 font-mono text-[11px] leading-relaxed text-zinc-300 border border-zinc-800/60 space-y-2">
                  <div className="flex items-center justify-between text-[10.5px] text-zinc-400 border-b border-zinc-800/80 pb-1.5">
                    <span>Base64URL(SHA256(code_verifier))</span>
                    <span className="text-emerald-400 font-bold">MATCH ✓</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10.5px]">
                    <div className="bg-zinc-900/80 p-2 rounded-lg border border-zinc-800">
                      <span className="text-zinc-500 block text-[9.5px]">Auth Code TTL</span>
                      <span className="text-white font-bold">60 Seconds</span>
                    </div>
                    <div className="bg-zinc-900/80 p-2 rounded-lg border border-zinc-800">
                      <span className="text-zinc-500 block text-[9.5px]">Replay Attack Check</span>
                      <span className="text-emerald-400 font-bold">Enforced (Single-Use)</span>
                    </div>
                  </div>
                </div>

                <p className="text-[11.5px] text-zinc-400 font-sans">
                  The authorization code is instantly consumed in exchange for signed JWT identity credentials.
                </p>
              </motion.div>
            )}

            {currentStep === 3 && (
              <motion.div
                key="step-3"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <KeyRound className="size-4 text-emerald-400" />
                    <span className="text-xs font-mono font-bold text-zinc-200">
                      Decoded RS256 JWT Payload
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={copyJwt}
                      className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors cursor-pointer"
                    >
                      {copiedJwt ? (
                        <>
                          <Check className="size-3 text-emerald-400" />
                          <span className="text-emerald-400 font-bold">Copied JSON</span>
                        </>
                      ) : (
                        <>
                          <Copy className="size-3" />
                          <span>Copy JSON</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={copyRaw}
                      className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors cursor-pointer"
                    >
                      {copiedRaw ? (
                        <>
                          <Check className="size-3 text-emerald-400" />
                          <span className="text-emerald-400 font-bold">Copied JWT</span>
                        </>
                      ) : (
                        <>
                          <Copy className="size-3" />
                          <span>Raw Token</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Syntax Highlighted JWT Inspector */}
                <div className="p-3 rounded-xl bg-black/70 font-mono text-[11px] leading-relaxed border border-zinc-800/80 overflow-x-auto max-h-[160px] scrollbar-thin">
                  <div className="text-zinc-500 mb-1 text-[10px]">
                    {`// 1. Header (Algorithm & Key ID)`}
                  </div>
                  <div className="text-rose-400">
                    &#123;&quot;alg&quot;: &quot;RS256&quot;, &quot;typ&quot;: &quot;JWT&quot;, &quot;kid&quot;: &quot;oid-key-2026&quot;&#125;
                  </div>

                  <div className="text-zinc-500 my-1 text-[10px]">
                    {`// 2. Payload (Claims)`}
                  </div>
                  <div className="text-emerald-400 space-y-0.5">
                    <div>&#123;</div>
                    <div className="pl-3">
                      <span className="text-zinc-400">&quot;iss&quot;: </span>
                      <span className="text-zinc-200">&quot;{jwtPayload.iss}&quot;,</span>
                    </div>
                    <div className="pl-3">
                      <span className="text-zinc-400">&quot;sub&quot;: </span>
                      <span className="text-amber-300">&quot;{jwtPayload.sub}&quot;,</span>
                    </div>
                    <div className="pl-3">
                      <span className="text-zinc-400">&quot;name&quot;: </span>
                      <span className="text-zinc-200">&quot;{jwtPayload.name}&quot;,</span>
                    </div>
                    <div className="pl-3">
                      <span className="text-zinc-400">&quot;email&quot;: </span>
                      <span className="text-cyan-300">&quot;{jwtPayload.email}&quot;,</span>
                    </div>
                    <div className="pl-3">
                      <span className="text-zinc-400">&quot;role&quot;: </span>
                      <span className="text-emerald-300 font-bold">&quot;{jwtPayload.role}&quot;,</span>
                    </div>
                    {persona === 'admin' && (
                      <div className="pl-3">
                        <span className="text-zinc-400">&quot;scopes&quot;: </span>
                        <span className="text-indigo-300">
                          [&quot;oid:admin&quot;, &quot;write:clients&quot;, &quot;read:audit&quot;],
                        </span>
                      </div>
                    )}
                    <div className="pl-3">
                      <span className="text-zinc-400">&quot;exp&quot;: </span>
                      <span className="text-zinc-400">{jwtPayload.exp}</span>
                    </div>
                    <div>&#125;</div>
                  </div>

                  <div className="text-zinc-500 mt-2 mb-1 text-[10px]">
                    {`// 3. Verified Cryptographic Signature`}
                  </div>
                  <div className="text-cyan-400 text-[10.5px]">
                    RSASHA256(Base64Url(Header) + &quot;.&quot; + Base64Url(Payload), PublicKey) <span className="text-emerald-400 font-bold">[VERIFIED ✓]</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bottom Spec Footnote Bar */}
        <div className="mt-4 pt-3 border-t border-zinc-800/60 flex flex-wrap items-center justify-between gap-2 text-[10.5px] font-mono text-zinc-400">
          <div className="flex items-center gap-1.5">
            <Lock className="size-3 text-zinc-500" />
            <span>Zero-Knowledge Server</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Zap className="size-3 text-emerald-400" />
            <span>Asymmetric RS256 Verification</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="size-3 text-white" />
            <span>FIDO2 / WebAuthn Ready</span>
          </div>
        </div>
      </div>
    </div>
  );
}
