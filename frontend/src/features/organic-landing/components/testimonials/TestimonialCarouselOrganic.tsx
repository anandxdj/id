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

interface TestimonialCarouselOrganicProps {
  className?: string;
}

export function TestimonialCarouselOrganic({
  className = '',
}: TestimonialCarouselOrganicProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  const handlePrev = () => {
    setActiveIndex((p) => (p - 1 + TESTIMONIALS_DATA.length) % TESTIMONIALS_DATA.length);
  };

  const handleNext = () => {
    setActiveIndex((p) => (p + 1) % TESTIMONIALS_DATA.length);
  };

  return (
    <section className={`relative mx-auto max-w-[1600px] px-4 sm:px-8 py-0 select-none ${className}`}>
      {/* Dark Organic Blob Island Container */}
      <div className="relative w-full aspect-[902/168] min-h-[220px] md:min-h-[250px] lg:min-h-[280px] flex flex-col justify-between items-center p-3 sm:p-4 md:p-5 lg:px-8 lg:py-4 select-none">
        {/* Background SVG: socialproff.svg */}
        <img
          src="/landing_components/socialproff.svg"
          alt=""
          className="absolute inset-0 w-full h-full object-fill pointer-events-none z-0 filter invert dark:filter-none drop-shadow-sm transition-[filter] duration-300"
          aria-hidden="true"
        />

        {/* Main Row: Prev Button + 3 Organic Cards + Next Button */}
        <div className="relative z-10 flex items-center justify-between gap-3 sm:gap-4 md:gap-5 w-full my-auto">
          {/* Left Arrow Button */}
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Previous Testimonials"
            className="cursor-pointer size-8 sm:size-9 lg:size-10 rounded-full bg-white border border-black/10 text-zinc-800 dark:bg-[#191919] dark:border-white/10 dark:text-zinc-300 flex items-center justify-center hover:bg-zinc-100 dark:hover:text-white dark:hover:bg-zinc-800 transition-all duration-200 shrink-0 shadow-lg active:scale-95 z-20"
          >
            <ArrowLeft className="size-4" />
          </button>

          {/* 3 Organic Testimonial Cards Grid */}
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 lg:gap-4 w-full">
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
                    y: isHovered ? -4 : isSelected ? -2 : 0,
                    scale: isHovered ? 1.02 : 1,
                  }}
                  transition={{
                    type: 'spring',
                    stiffness: 350,
                    damping: 25,
                  }}
                  className="relative group p-4 sm:p-5 lg:p-5 bg-zinc-900 text-zinc-50 border border-zinc-800 dark:bg-[#F3F3F2] dark:text-zinc-950 dark:border-white/20 rounded-2xl sm:rounded-3xl flex flex-col justify-between min-h-[140px] sm:min-h-[160px] lg:min-h-[180px] shadow-[0_12px_28px_-8px_rgba(0,0,0,0.3)] cursor-pointer overflow-hidden transition-all duration-300"
                >
                  {/* Card Content Top Section */}
                  <div className="relative z-10">
                    {item.badge ? (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 dark:bg-black/5 dark:border-black/10 mb-2 backdrop-blur-xs transition-transform duration-200 group-hover:scale-105">
                        <span className="size-1.5 rounded-full bg-zinc-100 dark:bg-zinc-950" />
                        <span className="text-[10px] font-bold text-zinc-100 dark:text-zinc-900 tracking-tight">
                          {item.badge}
                        </span>
                      </div>
                    ) : (
                      <div className="h-2 mb-1" />
                    )}

                    <div>
                      <span className="font-serif text-lg font-black leading-none block mb-0.5 text-zinc-300 dark:text-zinc-900 select-none">
                        “
                      </span>
                      <p className="text-[11px] sm:text-xs lg:text-[12.5px] font-semibold leading-snug text-zinc-100 dark:text-zinc-900 tracking-tight">
                        {item.quote}
                      </p>
                    </div>
                  </div>

                  {/* Card Content Bottom Author Section */}
                  <div className="relative z-10 mt-3 flex items-center gap-2.5">
                    <div className="size-7 sm:size-8 rounded-full bg-white text-zinc-950 dark:bg-zinc-950 dark:text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform duration-200">
                      <User className="size-3.5" />
                    </div>
                    <div>
                      <h5 className="font-heading font-black text-[11px] sm:text-xs text-zinc-100 dark:text-zinc-950 leading-tight">
                        {item.author}
                      </h5>
                      <p className="text-[9.5px] sm:text-[10px] text-zinc-400 dark:text-zinc-500 font-medium leading-tight mt-0.5">
                        {item.role}
                      </p>
                    </div>
                  </div>

                  {/* Subtle active border indicator */}
                  {isSelected && (
                    <div className="absolute inset-0 rounded-2xl sm:rounded-3xl border-2 border-white/20 dark:border-zinc-950/15 pointer-events-none" />
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
            className="cursor-pointer size-8 sm:size-9 lg:size-10 rounded-full bg-white border border-black/10 text-zinc-800 dark:bg-[#191919] dark:border-white/10 dark:text-zinc-300 flex items-center justify-center hover:bg-zinc-100 dark:hover:text-white dark:hover:bg-zinc-800 transition-all duration-200 shrink-0 shadow-lg active:scale-95 z-20"
          >
            <ArrowRight className="size-4" />
          </button>
        </div>

        {/* Modern Pill Indicator Dots at Bottom */}
        <div className="relative z-10 mt-2 sm:mt-3 flex items-center justify-center">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-black/5 dark:bg-zinc-900/90 rounded-full border border-black/10 dark:border-zinc-800/80 shadow-xs">
            {TESTIMONIALS_DATA.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveIndex(idx)}
                aria-label={`Go to testimonial ${idx + 1}`}
                className="cursor-pointer flex items-center justify-center p-0.5"
              >
                <div
                  className={`rounded-full transition-all duration-300 ${
                    idx === activeIndex
                      ? 'w-5 h-1.5 bg-zinc-950 dark:bg-white shadow-xs'
                      : 'size-1.5 bg-zinc-400 dark:bg-zinc-600 hover:bg-zinc-600 dark:hover:bg-zinc-400'
                  }`}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
