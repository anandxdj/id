'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, RefreshCw, Check, Copy, KeyRound, Terminal, Lock, CheckCircle2, ShieldCheck } from 'lucide-react';

export function OAuthSimulator() {
  const [step, setStep] = useState<1 | 2 | 3>(3);
  const [isSimulating, setIsSimulating] = useState(false);
  const [copied, setCopied] = useState(false);

  const runHandshake = () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setStep(1);
    
    setTimeout(() => {
      setStep(2);
      setTimeout(() => {
        setStep(3);
        setIsSimulating(false);
      }, 700);
    }, 600);
  };

  const copyToken = () => {
    navigator.clipboard.writeText(`eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c3JfOWEyOGZjMSIsImlzcyI6Imh0dHBzOi8vaWQub2lkLmRldiIsImF1ZCI6ImFjbWVfYXBwIiwic2NvcGUiOiJvcGVuaWQgcHJvZmlsZSBlbWFpbCIsImV4cCI6MTc3NjI4ODAwMH0.k8J2x_9L1...`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full bg-card border border-border/80 rounded-3xl shadow-brutal-lg overflow-hidden text-left flex flex-col justify-between transition-all duration-300">
      {/* Terminal Titlebar */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-muted/60 border-b border-border/60">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="size-3 rounded-full bg-destructive/60 inline-block" />
            <span className="size-3 rounded-full bg-warning/60 inline-block" />
            <span className="size-3 rounded-full bg-ok/60 inline-block" />
          </div>
          <span className="text-[11px] font-mono text-muted-foreground ml-2 font-medium">
            oauth2.1 :: pkce-handshake
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            RS256
          </span>
        </div>
      </div>

      {/* Simulator Body */}
      <div className="p-5 sm:p-6 flex flex-col gap-4 font-mono text-xs">
        {/* Step Progression Bar */}
        <div className="grid grid-cols-3 gap-2 bg-muted/40 p-1.5 rounded-xl border border-border/40">
          <div className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg transition-all ${
            step >= 1 ? 'bg-background text-foreground shadow-sm font-bold' : 'text-muted-foreground opacity-60'
          }`}>
            <span className="size-4 rounded-full bg-primary/10 text-primary text-[10px] flex items-center justify-center font-black">1</span>
            <span className="text-[10px] truncate">Authorize</span>
          </div>
          <div className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg transition-all ${
            step >= 2 ? 'bg-background text-foreground shadow-sm font-bold' : 'text-muted-foreground opacity-60'
          }`}>
            <span className="size-4 rounded-full bg-primary/10 text-primary text-[10px] flex items-center justify-center font-black">2</span>
            <span className="text-[10px] truncate">Verify PKCE</span>
          </div>
          <div className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg transition-all ${
            step >= 3 ? 'bg-background text-foreground shadow-sm font-bold' : 'text-muted-foreground opacity-60'
          }`}>
            <span className="size-4 rounded-full bg-primary/10 text-primary text-[10px] flex items-center justify-center font-black">3</span>
            <span className="text-[10px] truncate">Signed JWT</span>
          </div>
        </div>

        {/* Dynamic Display Area */}
        <div className="min-h-[168px] flex flex-col justify-center bg-muted/20 border border-border/60 rounded-2xl p-4 overflow-hidden relative">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex flex-col gap-2"
              >
                <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                  <span className="flex items-center gap-1.5 text-foreground font-semibold">
                    <Terminal className="size-3.5 text-primary" /> POST /oauth/v2/authorize
                  </span>
                  <span className="text-warning text-[10px] animate-pulse">Requesting Code...</span>
                </div>
                <div className="bg-background/80 p-3 rounded-xl border border-border/40 text-[10.5px] leading-relaxed overflow-x-auto text-foreground/85">
                  <div><span className="text-muted-foreground">client_id:</span> &quot;acme_client&quot;</div>
                  <div><span className="text-muted-foreground">response_type:</span> &quot;code&quot;</div>
                  <div><span className="text-muted-foreground">code_challenge:</span> &quot;E9Mel-2VpAAhju...&quot; (S256)</div>
                  <div><span className="text-muted-foreground">scope:</span> &quot;openid profile email&quot;</div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex flex-col gap-2"
              >
                <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                  <span className="flex items-center gap-1.5 text-foreground font-semibold">
                    <Lock className="size-3.5 text-primary" /> POST /oauth/v2/token
                  </span>
                  <span className="text-ok text-[10px] flex items-center gap-1">
                    <CheckCircle2 className="size-3" /> Verifying Challenge
                  </span>
                </div>
                <div className="bg-background/80 p-3 rounded-xl border border-border/40 text-[10.5px] leading-relaxed text-foreground/85">
                  <div className="flex items-center gap-2 text-ok">
                    <Check className="size-3.5" />
                    <span>SHA-256 Code Verifier Matched</span>
                  </div>
                  <div className="mt-1 text-muted-foreground text-[10px]">
                    Signing ID Token via asymmetric private key (RS256)...
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step-3"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex flex-col gap-2"
              >
                <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                  <span className="flex items-center gap-1.5 text-foreground font-semibold">
                    <ShieldCheck className="size-3.5 text-emerald-500" /> Decoded ID Token Payload
                  </span>
                  <button
                    onClick={copyToken}
                    className="flex items-center gap-1 text-[10px] hover:text-foreground text-muted-foreground transition-colors p-1 rounded hover:bg-muted cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="size-3 text-emerald-500" />
                        <span className="text-emerald-500 font-bold">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="size-3" />
                        <span>Copy JWT</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="bg-background/80 p-3 rounded-xl border border-border/40 text-[10.5px] leading-relaxed text-foreground/85">
                  <div><span className="text-muted-foreground">&quot;iss&quot;:</span> <span className="text-emerald-600 dark:text-emerald-400">&quot;https://id.oid.dev&quot;</span>,</div>
                  <div><span className="text-muted-foreground">&quot;sub&quot;:</span> <span className="text-primary font-bold">&quot;usr_9ae8fc17&quot;</span>,</div>
                  <div><span className="text-muted-foreground">&quot;aud&quot;:</span> <span>&quot;acme_client&quot;</span>,</div>
                  <div><span className="text-muted-foreground">&quot;scope&quot;:</span> <span>&quot;openid profile email&quot;</span>,</div>
                  <div><span className="text-muted-foreground">&quot;exp&quot;:</span> <span className="text-muted-foreground">1776288000</span></div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Simulator Footer Controls */}
      <div className="p-4 bg-muted/40 border-t border-border/60 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <KeyRound className="size-3.5 text-foreground/70" />
          <span>Strict OAuth 2.1 Compliant</span>
        </div>
        <button
          onClick={runHandshake}
          disabled={isSimulating}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-primary-foreground rounded-xl text-xs font-heading font-bold shadow-brutal-xs hover:scale-102 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
        >
          {isSimulating ? (
            <>
              <RefreshCw className="size-3 animate-spin" />
              <span>Verifying...</span>
            </>
          ) : (
            <>
              <Play className="size-3 fill-current" />
              <span>Simulate Handshake</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
