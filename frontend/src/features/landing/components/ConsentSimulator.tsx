'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Fingerprint, Check, Lock, X, RefreshCw, Sparkles, UserCheck, Shield } from 'lucide-react';

export function ConsentSimulator() {
  const [granted, setGranted] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [scopes, setScopes] = useState({
    profile: true,
    email: true,
    activity: false,
  });

  const toggleScope = (key: keyof typeof scopes) => {
    if (key === 'profile') return; // required
    setScopes(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleApprove = () => {
    if (isApproving) return;
    setIsApproving(true);
    setTimeout(() => {
      setIsApproving(false);
      setGranted(true);
    }, 800);
  };

  const handleRevoke = () => {
    setGranted(false);
  };

  return (
    <div className="w-full bg-card border border-border/80 rounded-3xl shadow-brutal-lg overflow-hidden text-left flex flex-col justify-between transition-all duration-300">
      {/* Titlebar */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-muted/60 border-b border-border/60">
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-heading font-black text-xs">
            L
          </div>
          <div>
            <h4 className="font-heading font-extrabold text-xs tracking-tight">Linear App</h4>
            <p className="text-[10px] text-muted-foreground leading-none">requests sovereign ID access</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
          granted 
            ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' 
            : 'text-amber-500 bg-amber-500/10 border-amber-500/20'
        }`}>
          <span className={`size-1.5 rounded-full ${granted ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
          {granted ? 'Session Active' : 'Consent Pending'}
        </span>
      </div>

      {/* Simulator Content Body */}
      <div className="p-5 sm:p-6 flex flex-col gap-4">
        <AnimatePresence mode="wait">
          {!granted ? (
            <motion.div
              key="prompt"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="flex flex-col gap-3.5"
            >
              <div className="text-[11.5px] text-foreground/80 leading-relaxed">
                Choose the exact attributes you want to grant. Your password and master keys never leave your device.
              </div>

              {/* Granular Scope Checkboxes */}
              <div className="flex flex-col gap-2">
                <div 
                  className="flex items-center justify-between p-2.5 rounded-xl border border-border/60 bg-muted/20 text-xs select-none"
                >
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="size-4 text-emerald-500 shrink-0" />
                    <div>
                      <div className="font-heading font-bold text-[11px]">Identity & Email</div>
                      <div className="text-[10px] text-muted-foreground">anand@oid.dev (Required)</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    Locked
                  </span>
                </div>

                <div 
                  onClick={() => toggleScope('email')}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                    scopes.email 
                      ? 'border-primary/40 bg-primary/5' 
                      : 'border-border/40 bg-muted/10 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <UserCheck className="size-4 text-primary shrink-0" />
                    <div>
                      <div className="font-heading font-bold text-[11px]">Display Name & Avatar</div>
                      <div className="text-[10px] text-muted-foreground">Share public profile info</div>
                    </div>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={scopes.email} 
                    onChange={() => {}} 
                    className="accent-primary size-4 cursor-pointer pointer-events-none" 
                  />
                </div>

                <div 
                  onClick={() => toggleScope('activity')}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                    scopes.activity 
                      ? 'border-primary/40 bg-primary/5' 
                      : 'border-border/40 bg-muted/10 opacity-70'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="size-4 text-primary shrink-0" />
                    <div>
                      <div className="font-heading font-bold text-[11px]">Offline Background Sync</div>
                      <div className="text-[10px] text-muted-foreground">Issue 30-day refresh token</div>
                    </div>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={scopes.activity} 
                    onChange={() => {}} 
                    className="accent-primary size-4 cursor-pointer pointer-events-none" 
                  />
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="granted"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col gap-3 py-2 text-center items-center justify-center min-h-[175px]"
            >
              <div className="size-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500 mb-1">
                <Check className="size-6 stroke-[3]" />
              </div>
              <h4 className="font-heading font-extrabold text-sm tracking-tight text-foreground">
                Connected via Sovereign Passkey
              </h4>
              <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                Linear is authenticated with scoped RS256 token authorization. You can revoke access anytime with one click.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Simulator Footer Controls */}
      <div className="p-4 bg-muted/40 border-t border-border/60 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Shield className="size-3.5 text-foreground/70" />
          <span>FIDO2 / WebAuthn Hardware Auth</span>
        </div>

        {!granted ? (
          <button
            onClick={handleApprove}
            disabled={isApproving}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-primary-foreground rounded-xl text-xs font-heading font-bold shadow-brutal-xs hover:scale-102 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
          >
            {isApproving ? (
              <>
                <RefreshCw className="size-3 animate-spin" />
                <span>Verifying Biometric...</span>
              </>
            ) : (
              <>
                <Fingerprint className="size-3.5" />
                <span>Approve with Passkey</span>
              </>
            )}
          </button>
        ) : (
          <button
            onClick={handleRevoke}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/30 rounded-xl text-xs font-heading font-bold transition-all cursor-pointer"
          >
            <X className="size-3.5" />
            <span>Revoke App Grant</span>
          </button>
        )}
      </div>
    </div>
  );
}
