'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { GooeyFilter } from './GooeyFilter';
import { ArrowUpRight, ShieldCheck, Lock, Sparkles, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface GooeyCardProps {
  title?: string;
  subtitle?: string;
  description?: string;
  icon?: React.ElementType;
  className?: string;
}

export function GooeyCard({
  title = 'Self-Hosted Sovereign Node',
  subtitle = 'RFC-6749 Compliant',
  description = 'Run your identity cluster locally or in your private VPC. Full database cryptographic ownership with automated key rotation.',
  icon: Icon = ShieldCheck,
  className = '',
}: GooeyCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative group rounded-3xl border border-border bg-card p-6 md:p-8 shadow-brutal-md transition-all duration-300 hover:shadow-brutal-lg overflow-hidden ${className}`}
    >
      <GooeyFilter id="card-gooey" strength="standard" />

      {/* Background Liquid Blobs that move on hover */}
      <div
        className="absolute -right-8 -top-8 size-48 pointer-events-none opacity-40 group-hover:opacity-75 transition-opacity"
        style={{
          filter: 'url(#card-gooey)',
          WebkitFilter: 'url(#card-gooey)',
        }}
      >
        <motion.div
          className="absolute size-28 rounded-full bg-foreground/20 dark:bg-foreground/30"
          animate={{
            x: isHovered ? [0, 15, -10, 0] : 0,
            y: isHovered ? [0, -10, 15, 0] : 0,
            scale: isHovered ? 1.2 : 1,
          }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute size-20 rounded-full bg-foreground/15 dark:bg-foreground/20 right-4 top-4"
          animate={{
            x: isHovered ? [0, -20, 10, 0] : 0,
            y: isHovered ? [0, 15, -15, 0] : 0,
            scale: isHovered ? 1.3 : 1,
          }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 space-y-4">
        <div className="flex items-start justify-between">
          <div className="size-12 rounded-2xl bg-muted flex items-center justify-center border border-border group-hover:bg-foreground group-hover:text-background transition-colors duration-300">
            <Icon className="size-6" />
          </div>
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-muted-foreground bg-muted/60 px-3 py-1 rounded-full border border-border">
            {subtitle}
          </span>
        </div>

        <div>
          <h4 className="text-xl font-bold font-heading group-hover:text-foreground transition-colors">
            {title}
          </h4>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed font-normal">
            {description}
          </p>
        </div>

        <div className="pt-2 flex items-center justify-between border-t border-border/80">
          <span className="text-xs font-mono text-muted-foreground">OIDC / PKCE</span>
          <div className="flex items-center gap-1 text-xs font-semibold group-hover:translate-x-1 transition-transform">
            <span>Explore Specs</span>
            <ArrowUpRight className="size-4" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
