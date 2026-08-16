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
    viewBox: '0 0 243.913 130.433',
    svgPath:
      'M29.8595 0.771643C41.1009 0.583869 95.0325 -1.48974 101.46 2.06163C105.261 4.15979 106.054 7.43355 107.155 11.3115L185.666 11.3931C197.886 11.5156 211.53 10.7155 223.555 12.6259C228.216 13.3688 232.743 14.5363 236.345 17.7529C242.544 23.2882 243.073 31.64 243.457 39.4204C244.105 52.5564 243.711 65.8393 243.715 78.9997C243.718 88.764 244.456 99.3446 243.064 108.995C242.387 113.689 241.333 119.102 237.976 122.694C231.726 129.372 223.283 129.56 214.764 129.903L35.1692 130.433C25.8433 130.384 13.7678 130.989 6.79478 123.698C3.57025 120.326 2.10774 115.738 1.3316 111.231C-1.09313 97.1485 0.521174 80.853 0.589729 66.525C0.641145 55.822 -0.0182859 45.0045 0.4363 34.3259C0.729291 27.4436 2.42602 20.6267 7.66559 15.8262L8.05815 15.4751C11.9282 11.9074 16.5418 12.8463 20.7302 10.5685C22.902 9.38473 23.5296 4.23321 29.8595 0.771643Z',
    box: 'lg:left-[8.549%] lg:top-[5.44%] lg:w-[27.054%] lg:h-[77.71%]',
  },
  {
    id: '2',
    quote:
      'The documentation is incredible. We were up and running in an hour.',
    author: 'James Wilson',
    role: 'Lead Engineer, Acme Inc',
    viewBox: '0 0 237.707 118.935',
    svgPath:
      'M22.7682 0.779893C59.8638 -0.861083 97.5414 0.592068 134.706 0.624724L184.158 0.559448C193.889 0.54312 203.838 0.143041 213.535 0.926791C218.559 1.33499 223.568 2.0453 227.888 4.83741C232.801 8.01323 235.04 12.6912 236.197 18.2999C238.167 27.8601 238.046 86.6984 236.77 97.8914C236.314 101.9 235.308 105.892 233.027 109.272C229.011 115.224 222.78 116.832 216.156 118.089C176.243 119.689 135.959 118.375 96.0209 118.277C73.1782 118.22 44.4985 119.926 22.4622 118.057C17.9906 117.681 13.6634 116.799 9.87169 114.277C4.71945 110.848 2.4147 105.827 1.30966 99.8835C-0.418095 90.6009 -0.297299 30.2766 0.864057 21.4431C1.40842 17.3121 2.56568 13.1322 5.00347 9.69509C9.4367 3.43325 15.565 1.9147 22.7682 0.779893Z',
    box: 'lg:left-[37.166%] lg:top-[12.61%] lg:w-[26.39%] lg:h-[71.13%]',
  },
  {
    id: '3',
    quote:
      'Security, flexibility, and performance—OID checks all the boxes.',
    author: 'Priya Patel',
    role: 'Director, VoxPay',
    viewBox: '0 0 237.204 118.604',
    svgPath:
      'M24.7783 0.540967C34.953 -0.324424 45.7904 0.287909 56.0264 0.263417L122.251 0.328694L180.202 0.230729C191.04 0.189908 202.196 -0.381568 212.993 0.443002C218.118 0.843041 223.619 1.76556 227.953 4.70462C232.719 7.92942 234.759 12.8687 235.788 18.3631C238.416 32.4216 236.596 53.3951 236.522 68.1068C236.473 77.9608 237.436 88.5822 236.114 98.322C235.592 102.143 234.523 105.923 232.286 109.107C228.059 115.124 222.003 116.552 215.221 117.801C178.576 118.928 141.643 118.022 104.971 118.038C78.7034 118.055 51.4495 119.475 25.2876 117.752C20.7287 117.45 13.5483 116.985 9.79248 114.266C4.64595 110.552 1.9152 105.368 1.02644 99.1384C-0.506259 88.4108 0.565323 76.1728 0.526965 65.3146C0.476364 51.0112 -0.926569 35.124 1.06479 20.9756C1.69403 16.5017 3.03492 11.7094 5.84731 8.09272C10.3385 2.32073 18.0191 1.33288 24.7783 0.540967Z',
    box: 'lg:left-[65.096%] lg:top-[12.61%] lg:w-[26.28%] lg:h-[71.13%]',
  },
];

const ARROW_BASE =
  'z-20 flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#191919] text-[#B9B8B8] shadow-lg transition-all duration-200 hover:bg-zinc-800 hover:text-white active:scale-95 sm:size-10 lg:absolute lg:top-[37.60%] lg:size-auto lg:h-[19.546%] lg:w-[3.626%]';

export function FigmaTestimonials({ className = '' }: { className?: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const displayedIndex = activeIndex % FIGMA_TESTIMONIALS_DATA.length;

  const handlePrev = () => {
    setActiveIndex((p) => (p - 1 + 4) % 4);
  };

  const handleNext = () => {
    setActiveIndex((p) => (p + 1) % 4);
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
        <img
          src="/landing_components/socialproff.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 size-full object-fill animate-island-breathe filter invert dark:filter-none drop-shadow-sm transition-[filter] duration-300"
        />

        {/* Mobile flow wrapper */}
        <div className="relative z-10 flex flex-col gap-5 px-4 py-8 lg:contents">
          {/* Cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:contents">
            {FIGMA_TESTIMONIALS_DATA.map((item, idx) => {
              const isSelected = displayedIndex === idx;
              const isHovered = hoveredCard === idx;

              return (
                <motion.div
                  key={item.id}
                  onMouseEnter={() => setHoveredCard(idx)}
                  onMouseLeave={() => setHoveredCard(null)}
                  onClick={() => setActiveIndex(idx)}
                  initial={false}
                  animate={{
                    y: isHovered ? -5 : isSelected ? -2 : 0,
                    scale: isHovered ? 1.03 : 1,
                  }}
                  transition={{ type: 'spring', stiffness: 350, damping: 22 }}
                  className={`group @container relative z-10 flex min-h-[220px] cursor-pointer select-none flex-col justify-between p-6 lg:absolute lg:min-h-0 lg:p-[7.4cqw] ${item.box}`}
                >
                  {/* Verbatim Figma blob */}
                  <svg
                    className="pointer-events-none absolute inset-0 z-0 size-full drop-shadow-[0_12px_24px_rgba(0,0,0,0.4)] transition-all duration-300 group-hover:drop-shadow-[0_18px_32px_rgba(0,0,0,0.5)]"
                    viewBox={item.viewBox}
                    fill="none"
                    preserveAspectRatio="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d={item.svgPath} className="fill-zinc-900 dark:fill-[#F3F3F2] transition-colors duration-300" />
                  </svg>

                  <div className="relative z-10">
                    {item.badge ? (
                      <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 dark:border-black/10 dark:bg-black/5 px-2.5 py-0.5 backdrop-blur-xs lg:mb-[2cqw] lg:gap-[1.2cqw] lg:px-[2.4cqw] lg:py-[0.5cqw]">
                        <span className="size-1.5 rounded-full bg-zinc-100 dark:bg-zinc-950 lg:size-[1.2cqw]" />
                        <span className="text-[10px] font-bold tracking-tight text-zinc-100 dark:text-zinc-900 lg:text-[3cqw]">
                          {item.badge}
                        </span>
                      </div>
                    ) : null}

                    <p className="text-[11.5px] font-semibold leading-relaxed tracking-tight text-zinc-100 dark:text-zinc-900 lg:text-[3.7cqw]">
                      <span className="font-serif text-lg font-black leading-none lg:text-[6cqw] text-zinc-300 dark:text-zinc-900">
                        &ldquo;
                      </span>
                      {item.quote}
                    </p>
                  </div>

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
              );
            })}
          </div>

          {/* Arrows with Magnetic Effect */}
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

          {/* Indicator dots */}
          <div className="z-20 flex items-center justify-center gap-1.5 lg:absolute lg:bottom-[6.69%] lg:left-1/2 lg:-translate-x-1/2 lg:gap-[0.798cqw]">
            {Array.from({ length: 4 }, (_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveIndex(idx)}
                aria-label={`Go to testimonial position ${idx + 1}`}
                aria-current={idx === activeIndex}
                className="relative flex cursor-pointer items-center justify-center before:absolute before:-inset-2 before:content-['']"
              >
                <span
                  className={`rounded-full transition-all duration-300 ${
                    idx === activeIndex
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
