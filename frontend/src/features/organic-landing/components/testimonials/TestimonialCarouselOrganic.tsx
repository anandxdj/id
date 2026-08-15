'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, User } from 'lucide-react';

export const TESTIMONIALS_DATA = [
  {
    id: '1',
    badge: 'Loved by developers',
    quote:
      'OID is exactly what we needed. Easy to self-host, simple to integrate, and super reliable.',
    author: 'Sarah Chen',
    role: 'Developer',
  },
  {
    id: '2',
    quote:
      'Our users love the control over their data. And we love how fast and secure it is.',
    author: 'James Wilson',
    role: 'CTO, Acme Inc.',
  },
  {
    id: '3',
    quote:
      'The documentation is amazing and the community is super helpful.',
    author: 'Priya Patel',
    role: 'Indie Developer',
  },
];

export function TestimonialCarouselOrganic() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  const handlePrev = () => {
    setActiveIndex((p) => (p - 1 + TESTIMONIALS_DATA.length) % TESTIMONIALS_DATA.length);
  };

  const handleNext = () => {
    setActiveIndex((p) => (p + 1) % TESTIMONIALS_DATA.length);
  };

  return (
    <section className="relative mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-4 sm:py-6 select-none">
      {/* Main Row: Prev Button + 3 Organic Cards + Next Button */}
      <div className="relative flex items-center justify-between gap-3 sm:gap-6">
        {/* Left Arrow Button */}
        <button
          type="button"
          onClick={handlePrev}
          aria-label="Previous Testimonials"
          className="cursor-pointer size-10 sm:size-12 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 flex items-center justify-center hover:text-white hover:border-zinc-700 hover:bg-zinc-800 transition-all duration-200 shrink-0 shadow-lg active:scale-95 z-20"
        >
          <ArrowLeft className="size-4 sm:size-5" />
        </button>

        {/* 3 Organic Testimonial Cards Grid */}
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 lg:gap-6 w-full">
          {TESTIMONIALS_DATA.map((item, idx) => {
            const isSelected = activeIndex === idx;
            const isHovered = hoveredCard === idx;

            return (
              <motion.div
                key={item.id}
                onMouseEnter={() => setHoveredCard(idx)}
                onMouseLeave={() => setHoveredCard(null)}
                onClick={() => setActiveIndex(idx)}
                initial={false}
                animate={{
                  y: isHovered ? -6 : isSelected ? -2 : 0,
                  scale: isHovered ? 1.02 : 1,
                }}
                transition={{
                  type: 'spring',
                  stiffness: 350,
                  damping: 25,
                }}
                className="relative group p-7 sm:p-8 bg-[#F3F3F2] text-zinc-950 rounded-[32px] sm:rounded-[36px] flex flex-col justify-between min-h-[280px] sm:min-h-[300px] shadow-[0_20px_45px_-12px_rgba(0,0,0,0.5)] cursor-pointer overflow-hidden transition-all duration-300 border border-white/20"
              >
                {/* Card Content Top Section */}
                <div className="relative z-10">
                  {item.badge ? (
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/5 border border-black/10 mb-3.5 backdrop-blur-xs transition-transform duration-200 group-hover:scale-105">
                      <span className="size-1.5 rounded-full bg-zinc-950 animate-pulse" />
                      <span className="text-[11px] font-bold text-zinc-900 tracking-tight">
                        {item.badge}
                      </span>
                    </div>
                  ) : (
                    <div className="h-4 mb-2" />
                  )}

                  <div className="text-zinc-950">
                    <span className="font-serif text-3xl font-black leading-none block mb-1.5 text-zinc-900 select-none">
                      “
                    </span>
                    <p className="text-xs sm:text-[13.5px] md:text-[14px] font-semibold leading-relaxed text-zinc-900 tracking-tight">
                      {item.quote}
                    </p>
                  </div>
                </div>

                {/* Card Content Bottom Author Section */}
                <div className="relative z-10 mt-6 flex items-center gap-3">
                  <div className="size-9 rounded-full bg-zinc-950 text-white flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition-transform duration-200">
                    <User className="size-4" />
                  </div>
                  <div>
                    <h5 className="font-heading font-black text-xs sm:text-[13px] text-zinc-950 leading-tight">
                      {item.author}
                    </h5>
                    <p className="text-[11px] text-zinc-500 font-medium leading-tight mt-0.5">
                      {item.role}
                    </p>
                  </div>
                </div>

                {/* Subtle active border indicator */}
                {isSelected && (
                  <div className="absolute inset-0 rounded-[32px] sm:rounded-[36px] border-2 border-zinc-950/15 pointer-events-none" />
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Right Arrow Button */}
        <button
          type="button"
          onClick={handleNext}
          aria-label="Next Testimonials"
          className="cursor-pointer size-10 sm:size-12 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300 flex items-center justify-center hover:text-white hover:border-zinc-700 hover:bg-zinc-800 transition-all duration-200 shrink-0 shadow-lg active:scale-95 z-20"
        >
          <ArrowRight className="size-4 sm:size-5" />
        </button>
      </div>

      {/* Modern Pill Indicator Dots at Bottom */}
      <div className="mt-6 flex items-center justify-center">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/90 rounded-full border border-zinc-800/80 shadow-md">
          {TESTIMONIALS_DATA.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setActiveIndex(idx)}
              aria-label={`Go to testimonial ${idx + 1}`}
              className="cursor-pointer flex items-center justify-center p-1"
            >
              <div
                className={`rounded-full transition-all duration-300 ${
                  idx === activeIndex
                    ? 'w-6 h-2 bg-white shadow-xs'
                    : 'size-2 bg-zinc-600 hover:bg-zinc-400'
                }`}
              />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

