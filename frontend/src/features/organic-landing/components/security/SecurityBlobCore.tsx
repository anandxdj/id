'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  Key,
  Lock,
  UserCheck,
  FileText,
  Activity,
  Sparkles,
  Fingerprint,
} from 'lucide-react';
import { ClayLock3D } from '../common/ClayLock3D';

interface OrbitNode {
  id: string;
  label: string;
  desc: string;
  icon: React.ElementType;
}

const SECURITY_ORBITS: OrbitNode[] = [
  {
    id: 'mfa',
    label: 'MFA & Passkeys',
    desc: 'FIDO2 Hardware Security Keys',
    icon: Fingerprint,
  },
  {
    id: 'pkce',
    label: 'PKCE Strict',
    desc: 'S256 Cryptographic Code Challenge',
    icon: Lock,
  },
  {
    id: 'rbac',
    label: 'Role-Based Access',
    desc: 'Granular Least-Privilege Scopes',
    icon: UserCheck,
  },
  {
    id: 'session',
    label: 'Session Control',
    desc: 'Instant Real-Time Revocation',
    icon: Activity,
  },
  {
    id: 'token',
    label: 'Token Validation',
    desc: 'Asymmetric RS256 & ES256 Verification',
    icon: Key,
  },
  {
    id: 'audit',
    label: 'Audit Logs',
    desc: 'Tamper-Proof Cryptographic Trail',
    icon: FileText,
  },
];

export function SecurityBlobCore() {
  const [activeNode, setActiveNode] = useState<string | null>(null);

  return (
    <div className="relative w-full max-w-xl mx-auto flex flex-col items-center justify-center select-none py-6">
      {/* Central Living Shielded Core */}
      <div className="relative flex items-center justify-center">
        {/* Soft Radial Protective Pulse */}
        <motion.div
          className="absolute size-64 sm:size-72 rounded-full bg-zinc-200/60 -z-10 blur-xl"
          animate={{
            scale: [1, 1.12, 1],
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        />

        <ClayLock3D />
      </div>

      {/* 6 Orbiting Security Feature Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full mt-6">
        {SECURITY_ORBITS.map((node) => {
          const Icon = node.icon;
          const isActive = activeNode === node.id;

          return (
            <motion.div
              key={node.id}
              onClick={() => setActiveNode(isActive ? null : node.id)}
              whileHover={{ y: -2, scale: 1.02 }}
              className={`p-3 rounded-2xl border transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-zinc-950 text-white border-zinc-950 shadow-lg'
                  : 'bg-white text-zinc-950 border-zinc-200 hover:border-zinc-400 shadow-sm'
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`size-6 rounded-lg flex items-center justify-center shrink-0 ${
                    isActive ? 'bg-zinc-800 text-white' : 'bg-zinc-100 text-zinc-950'
                  }`}
                >
                  <Icon className="size-3.5" />
                </div>
                <h5 className="font-heading font-bold text-xs truncate">{node.label}</h5>
              </div>
              <p
                className={`text-[10px] mt-1 line-clamp-1 ${
                  isActive ? 'text-zinc-400' : 'text-zinc-500'
                }`}
              >
                {node.desc}
              </p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
