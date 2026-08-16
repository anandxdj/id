'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, User } from 'lucide-react';
import { MagneticButton } from '@/components/ui/gooey';

export const FIGMA_TESTIMONIALS_DATA = [
  {
    id: '1',
    badge: 'Leader in security',
    quote:
      'OID gave us an enterprise-grade SSO without vendor lock-in. Setup took less than a day.',
    author: 'Sarah Chen',
    role: 'CTO @ CloudScale',
    viewBox: '0 0 240 120',
    // Distinct Organic Fluid Squircle 1: Soft top-left organic flair, gentle continuous bezier curves
    svgPath:
      'M 28 2.5 C 76 0.2, 164 0.8, 212 2.5 C 228 3.5, 237.5 12, 238.5 28 C 240 50, 239 82, 237 98 C 234.5 112, 224 118, 208 119 C 165 120.2, 75 119.5, 30 118 C 14 117, 3 110, 1.5 94 C -0.5 74, 0.5 44, 2 26 C 3.5 10, 12 3, 28 2.5 Z',
    box: 'lg:left-[8.549%] lg:top-[12.61%] lg:w-[26.39%] lg:h-[71.13%]',
    floatClass: 'animate-float-sine-1',
    delay: 0,
  },
  {
    id: '2',
    badge: 'Fast & Reliable',
    quote:
      'The documentation is incredible. We were up and running in an hour.',
    author: 'James Wilson',
    role: 'Lead Engineer, Acme Inc',
    viewBox: '0 0 240 120',
    // Distinct Organic Fluid Squircle 2: Centered fluid squircle with subtle organic waist
    svgPath:
      'M 24 1.8 C 80 -0.5, 160 1.2, 214 2 C 229 3, 237.5 12, 238 27 C 239.5 54, 239.5 78, 237.5 97 C 234 113, 225 118.5, 212 119 C 162 120, 82 118.5, 26 118 C 11 117, 2.5 109, 1.5 95 C 0.5 75, -0.5 45, 1.5 24 C 3 9, 11 2.5, 24 1.8 Z',
    box: 'lg:left-[37.166%] lg:top-[12.61%] lg:w-[26.39%] lg:h-[71.13%]',
    floatClass: 'animate-float-sine-2',
    delay: 0.1,
  },
  {
    id: '3',
    badge: 'Privacy First',
    quote:
      'Security, flexibility, and performance—OID checks all the boxes.',
    author: 'Priya Patel',
    role: 'Director, VoxPay',
    viewBox: '0 0 240 120',
    // Distinct Organic Fluid Squircle 3: Fluid asymmetric curvature with smooth organic base
    svgPath:
      'M 26 2.2 C 70 0.5, 170 -0.5, 214 1.8 C 229 2.8, 237.5 11, 238.5 26 C 240 50, 239 80, 237 96 C 234.5 111, 225 117.5, 210 118.5 C 168 120, 78 120.2, 28 118.5 C 12 117, 3 111, 1.5 96 C -0.5 76, 0.5 48, 2 28 C 3.5 12, 12 3, 26 2.2 Z',
    box: 'lg:left-[65.096%] lg:top-[12.61%] lg:w-[26.28%] lg:h-[71.13%]',
    floatClass: 'animate-float-sine-3',
    delay: 0.2,
  },
];

export function FigmaTestimonials({ className = '' }: { className?: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const total = FIGMA_TESTIMONIALS_DATA.length;
  const displayedIndex = activeIndex % total;

  const handlePrev = () => {
    setActiveIndex((p) => (p - 1 + total) % total);
  };

  const handleNext = () => {
    setActiveIndex((p) => (p + 1) % total);
  };

  return (
    <section
      className={`relative w-full select-none px-4 py-6 sm:px-6 lg:aspect-[941/167.3] lg:px-0 lg:py-0 ${className}`}
    >
      <motion.div
        initial={{ opacity: 0, y: 25 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="@container relative w-full lg:absolute lg:inset-y-0 lg:left-[2.157%] lg:w-[95.844%]"
      >
        {/* Background Island SVG */}
        <img
          src="/landing_components/socialproff.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 size-full object-fill animate-island-breathe filter invert dark:filter-none drop-shadow-sm transition-[filter] duration-300"
        />

        {/* Mobile flow wrapper */}
        <div className="relative z-10 flex flex-col gap-5 px-4 py-8 lg:contents">
          {/* 3 Distinct Gooey Organic Cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:contents">
            {FIGMA_TESTIMONIALS_DATA.map((item, idx) => {
              const isSelected = displayedIndex === idx;
              const isHovered = hoveredCard === idx;

              return (
                <div
                  key={item.id}
                  className={`@container relative z-10 lg:absolute ${item.box}`}
                >
                  <motion.div
                    onMouseEnter={() => setHoveredCard(idx)}
                    onMouseLeave={() => setHoveredCard(null)}
                    onClick={() => setActiveIndex(idx)}
                    whileHover={{
                      scale: 1.045,
                      y: -4,
                      transition: { type: 'spring', stiffness: 400, damping: 18 },
                    }}
                    whileTap={{ scale: 0.98 }}
                    animate={{
                      y: isSelected && !isHovered ? -2 : 0,
                    }}
                    className={`group relative flex min-h-[220px] cursor-pointer select-none flex-col justify-between p-6 lg:min-h-0 lg:size-full lg:p-[7.4cqw] ${item.floatClass}`}
                  >
                    {/* Handcrafted Organic Squircle Vector Background */}
                    <svg
                      className="pointer-events-none absolute inset-0 z-0 size-full drop-shadow-[0_12px_24px_rgba(0,0,0,0.35)] dark:drop-shadow-[0_16px_32px_rgba(0,0,0,0.5)] transition-all duration-300 group-hover:drop-shadow-[0_20px_40px_rgba(0,0,0,0.45)]"
                      viewBox={item.viewBox}
                      fill="none"
                      preserveAspectRatio="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      {/* Base Organic Blob Fill */}
                      <path
                        d={item.svgPath}
                        className="fill-zinc-900 dark:fill-[#F3F3F2] transition-colors duration-300"
                      />

                      {/* Tactile Soft Inner Specular Rim */}
                      <path
                        d={item.svgPath}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        className="text-white/10 dark:text-black/8 transition-colors duration-300"
                      />
                    </svg>

                    {/* Micro-floating ambient gooey droplet in corner */}
                    <motion.div
                      animate={{
                        scale: isHovered ? [1, 1.3, 1] : 1,
                        opacity: isHovered ? 0.9 : 0.4,
                      }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      className="pointer-events-none absolute right-3 top-3 size-2 rounded-full bg-white/20 dark:bg-black/10 blur-[0.5px] transition-opacity"
                    />

                    {/* Top Section: Badge & Quote */}
                    <div className="relative z-10">
                      {item.badge ? (
                        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 dark:border-black/10 dark:bg-black/5 px-2.5 py-0.5 backdrop-blur-xs transition-transform duration-200 group-hover:scale-105 lg:mb-[2cqw] lg:gap-[1.2cqw] lg:px-[2.4cqw] lg:py-[0.5cqw]">
                          <span className="size-1.5 rounded-full bg-zinc-100 dark:bg-zinc-950 animate-pulse lg:size-[1.2cqw]" />
                          <span className="text-[10px] font-bold tracking-tight text-zinc-100 dark:text-zinc-900 lg:text-[3cqw]">
                            {item.badge}
                          </span>
                        </div>
                      ) : null}

                      <p className="text-[11.5px] font-semibold leading-relaxed tracking-tight text-zinc-100 dark:text-zinc-900 lg:text-[3.7cqw]">
                        <span className="font-serif text-lg font-black leading-none lg:text-[6cqw] text-zinc-400 dark:text-zinc-900 mr-1 select-none">
                          &ldquo;
                        </span>
                        {item.quote}
                      </p>
                    </div>

                    {/* Bottom Section: Author Avatar & Meta */}
                    <div className="relative z-10 mt-4 flex items-center gap-2.5 lg:mt-[3cqw] lg:gap-[2.4cqw]">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-zinc-950 dark:bg-zinc-950 dark:text-white shadow-md transition-transform duration-200 group-hover:scale-110 lg:size-[8.2cqw]">
                        <User className="size-3.5 lg:size-[4cqw]" />
                      </div>
                      <div>
                        <h5 className="font-heading text-xs font-black leading-tight text-zinc-100 dark:text-zinc-950 lg:text-[3.6cqw]">
                          {item.author}
                        </h5>
                        <p className="mt-0.5 text-[10px] font-medium leading-tight text-zinc-400 dark:text-zinc-500 lg:mt-[0.4cqw] lg:text-[3cqw]">
                          {item.role}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                </div>
              );
            })}
          </div>

          {/* Magnetic Prev / Next Navigation Arrows */}
          <div className="flex items-center justify-center gap-3 lg:contents">
            <MagneticButton strength={0.25} className="lg:contents">
              <button
                type="button"
                onClick={handlePrev}
                aria-label="Previous testimonial"
                className="z-20 flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white text-zinc-900 border border-black/10 hover:bg-zinc-100 dark:bg-[#191919] dark:text-[#B9B8B8] dark:border-white/10 dark:hover:bg-zinc-800 dark:hover:text-white shadow-lg transition-all duration-200 active:scale-95 sm:size-10 lg:absolute lg:top-[37.60%] lg:size-auto lg:h-[19.546%] lg:w-[3.626%] lg:left-[2.45%]"
              >
                <ArrowLeft className="size-4 lg:size-[1.55cqw]" />
              </button>
            </MagneticButton>

            <MagneticButton strength={0.25} className="lg:contents">
              <button
                type="button"
                onClick={handleNext}
                aria-label="Next testimonial"
                className="z-20 flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white text-zinc-900 border border-black/10 hover:bg-zinc-100 dark:bg-[#191919] dark:text-[#B9B8B8] dark:border-white/10 dark:hover:bg-zinc-800 dark:hover:text-white shadow-lg transition-all duration-200 active:scale-95 sm:size-10 lg:absolute lg:top-[37.60%] lg:size-auto lg:h-[19.546%] lg:w-[3.626%] lg:left-[93.83%]"
              >
                <ArrowRight className="size-4 lg:size-[1.55cqw]" />
              </button>
            </MagneticButton>
          </div>

          {/* Indicator Pagination Dots */}
          <div className="z-20 flex items-center justify-center gap-1.5 lg:absolute lg:bottom-[6.69%] lg:left-1/2 lg:-translate-x-1/2 lg:gap-[0.798cqw]">
            {Array.from({ length: total }, (_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveIndex(idx)}
                aria-label={`Go to testimonial position ${idx + 1}`}
                aria-current={idx === displayedIndex}
                className="relative flex cursor-pointer items-center justify-center before:absolute before:-inset-2 before:content-['']"
              >
                <span
                  className={`rounded-full transition-all duration-300 ${
                    idx === displayedIndex
                      ? 'h-1.5 w-5 bg-zinc-950 dark:bg-[#F3F3F2] lg:h-[0.554cqw] lg:w-[1.02cqw]'
                      : 'size-1.5 bg-zinc-400 dark:bg-[#69696B] hover:bg-zinc-600 dark:hover:bg-zinc-400 lg:size-[0.61cqw]'
                  }`}
                />
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  );
}

