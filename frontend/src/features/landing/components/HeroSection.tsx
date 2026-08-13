'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Shield, Zap, CheckCircle2, User, Code, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { User as UserType } from '@/types';

interface HeroSectionProps {
  user: UserType | null;
  connectedAppsCount: number;
  mode: 'user' | 'dev';
}

export function HeroSection({ user, mode }: HeroSectionProps) {
  const isDev = mode === 'dev';
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  // Surrounding cards data
  const surroundingCards = [
    {
      id: 0,
      icon: Shield,
      title: 'Secure',
      desc: 'Industry standard security',
      posClass: 'top-[8%] left-[2%] lg:top-[12%] lg:left-[5%]',
      // Connection path logic
      curvePath: 'M 15 25 Q 40 25 50 50',
    },
    {
      id: 1,
      icon: Zap,
      title: 'Fast',
      desc: 'Built for performance',
      posClass: 'top-[8%] right-[2%] lg:top-[12%] lg:right-[5%]',
      curvePath: 'M 85 25 Q 60 25 50 50',
    },
    {
      id: 2,
      icon: CheckCircle2,
      title: 'Reliable',
      desc: '99.99% uptime you can trust',
      posClass: 'bottom-[8%] left-[2%] lg:bottom-[12%] lg:left-[5%]',
      curvePath: 'M 15 75 Q 40 75 50 50',
    },
    {
      id: 3,
      icon: User,
      title: 'You own your data',
      desc: 'Export or delete anytime',
      posClass: 'bottom-[8%] right-[2%] lg:bottom-[12%] lg:right-[5%]',
      curvePath: 'M 85 75 Q 60 75 50 50',
    },
  ];

  return (
    <section className="relative z-10 mx-auto grid max-w-7xl gap-12 px-6 py-12 md:py-20 lg:grid-cols-12 items-center">
      {/* LEFT COLUMN: Hero Heading & CTA Widget (occupies 6 columns) */}
      <div className="lg:col-span-6 flex flex-col justify-stretch">
        <div className="bg-white dark:bg-white text-black shape-organic-lg flex flex-col justify-between p-8 sm:p-14 min-h-[520px] shadow-brutal-xl relative border border-black/10">
          
          {/* Top content */}
          <div>
            <div className="inline-flex items-center gap-2 border border-black/10 bg-black/5 px-4 py-1.5 rounded-full font-bold">
              <span className="size-2 bg-black rounded-full animate-pulse" />
              <span className="eyebrow text-black font-extrabold text-[10px]">OpenID Connect Provider</span>
            </div>
            
            {/* Smooth transition between titles depending on Navbar mode */}
            <h1 className="mt-8 font-heading text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.05] tracking-tight text-black">
              <AnimatePresence mode="wait">
                {isDev ? (
                  <motion.div
                    key="dev-title"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.3 }}
                  >
                    One Engine.
                    <br />
                    For Every App.
                  </motion.div>
                ) : (
                  <motion.div
                    key="user-title"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.3 }}
                  >
                    Your Identity.
                    <br />
                    Your Way.
                  </motion.div>
                )}
              </AnimatePresence>
            </h1>

            {/* Description */}
            <p className="mt-6 max-w-md text-sm sm:text-base text-black/75 leading-relaxed font-medium">
              <AnimatePresence mode="wait">
                {isDev ? (
                  <motion.span
                    key="dev-desc"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35 }}
                  >
                    OID is a spec-compliant OpenID Connect provider built on RS256 token signatures and OAuth 2.1 authorization parameters.
                  </motion.span>
                ) : (
                  <motion.span
                    key="user-desc"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35 }}
                  >
                    OID is a self-hosted OpenID Connect provider that&apos;s secure, fast, and built for you to own your identity and access everything seamlessly.
                  </motion.span>
                )}
              </AnimatePresence>
            </p>
          </div>

          {/* Bottom actions */}
          <div>
            <div className="mt-8 flex flex-wrap items-center gap-4 z-10">
              <Link href={user ? "/account" : "/login"}>
                <button className="flex items-center gap-2 px-6 py-3 bg-black hover:bg-black/90 text-white rounded-full font-heading text-xs font-bold tracking-wider uppercase transition-all duration-300 group shadow-md hover:scale-102 cursor-pointer">
                  Get Started 
                  <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
                </button>
              </Link>
              <a href="#docs">
                <button className="flex items-center gap-2 px-6 py-3 border border-black/20 hover:bg-black/5 text-black rounded-full font-heading text-xs font-bold tracking-wider uppercase transition-all duration-300 cursor-pointer">
                  View Docs 
                  <ArrowRight className="size-4 -rotate-45" />
                </button>
              </a>
            </div>

            {/* Inline bullets matching mockup */}
            <div className="mt-10 pt-6 border-t border-black/10 flex items-center justify-between flex-wrap gap-4 text-black/70">
              <div className="flex items-center gap-2">
                <Lock className="size-4 shrink-0" />
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Secure by default</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="size-4 shrink-0" />
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Blazing fast</span>
              </div>
              <div className="flex items-center gap-2">
                <Code className="size-4 shrink-0" />
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Open source</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Interactive Blob Graphic (occupies 6 columns) */}
      <div className="lg:col-span-6 relative w-full h-[520px] flex items-center justify-center overflow-hidden">
        
        {/* Background SVG connecting curves */}
        <svg className="absolute inset-0 size-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
          {surroundingCards.map((card) => {
            const isHovered = hoveredCard === card.id;
            return (
              <motion.path
                key={card.id}
                d={card.curvePath}
                fill="none"
                stroke={isHovered ? 'var(--color-primary)' : 'var(--color-border)'}
                strokeWidth={isHovered ? '0.75' : '0.4'}
                strokeDasharray={isHovered ? 'none' : '1.5, 1.5'}
                animate={{
                  strokeDashoffset: isHovered ? [0, -10] : 0,
                }}
                transition={{
                  repeat: Infinity,
                  duration: 2,
                  ease: 'linear',
                }}
              />
            );
          })}
        </svg>

        {/* Floating cards */}
        {surroundingCards.map((card) => {
          const Icon = card.icon;
          const isHovered = hoveredCard === card.id;
          return (
            <div
              key={card.id}
              className={`absolute ${card.posClass} max-w-[190px] p-4 bg-card/90 backdrop-blur-md border rounded-2xl shadow-brutal-sm transition-all duration-300 z-20 cursor-pointer ${
                isHovered ? 'scale-105 border-primary shadow-brutal' : 'hover:border-primary/50'
              }`}
              onMouseEnter={() => setHoveredCard(card.id)}
              onMouseLeave={() => setHoveredCard(null)}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`p-1.5 rounded-lg border transition-colors ${
                  isHovered ? 'bg-primary text-background border-primary' : 'bg-muted/80 text-foreground border-border'
                }`}>
                  <Icon className="size-3.5" />
                </span>
                <h4 className="font-heading font-extrabold text-[11px] tracking-tight">{card.title}</h4>
              </div>
              <p className="text-[10px] text-muted-foreground leading-snug">{card.desc}</p>
            </div>
          );
        })}

        {/* Central organic OID Blob */}
        <div 
          className={`relative z-10 size-40 md:size-48 bg-foreground dark:bg-foreground flex items-center justify-center transition-all duration-700 shadow-brutal-xl select-none group ${
            hoveredCard !== null ? 'animate-warp-fast scale-105' : 'animate-warp-slow'
          }`}
        >
          {/* Gooey overlay container */}
          <div className="absolute inset-0.5 bg-background dark:bg-background rounded-full mix-blend-difference" />
          
          <span className="font-heading font-black text-4xl tracking-widest text-background dark:text-background z-20 transition-transform duration-300 group-hover:scale-110">
            OID
          </span>
        </div>
      </div>
    </section>
  );
}
