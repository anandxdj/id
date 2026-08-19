'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Home, KeyRound, Plus, ShieldCheck, Terminal, X } from 'lucide-react';
import type { ElementType } from 'react';
import { useEffect, useState } from 'react';
import { GooeyFilter } from './GooeyFilter';

export interface GooeySpeedDialItem {
  label: string;
  icon: ElementType;
  onClick: () => void;
  tone?: 'light' | 'accent';
}

interface GooeySpeedDialProps {
  items?: GooeySpeedDialItem[];
  label?: string;
  className?: string;
}

const defaultItems: GooeySpeedDialItem[] = [
  { label: 'Home', icon: Home, onClick: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
  { label: 'Security', icon: ShieldCheck, onClick: () => document.getElementById('security')?.scrollIntoView({ behavior: 'smooth' }) },
  { label: 'Developer mode', icon: Terminal, onClick: () => document.getElementById('docs')?.scrollIntoView({ behavior: 'smooth' }) },
  { label: 'Sign in', icon: KeyRound, onClick: () => window.location.assign('/login'), tone: 'accent' },
];

export function GooeySpeedDial({ items = defaultItems, label = 'Quick actions', className = '' }: GooeySpeedDialProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const handleItemClick = (item: GooeySpeedDialItem) => {
    item.onClick();
    setOpen(false);
  };

  return (
    <div className={'fixed bottom-5 right-5 z-50 sm:bottom-8 sm:right-8 ' + className}>
      <GooeyFilter id="gooey-speed-dial" strength="standard" />
      <div className="relative flex size-16 items-center justify-center">
        <AnimatePresence>
          {open && (
            <motion.div className="absolute inset-0" initial="closed" animate="open" exit="closed" aria-label={label}>
              {items.map((item, index) => {
                const Icon = item.icon;
                const angle = Math.PI * (1.12 + index * 0.22);
                const distance = 88 + (index % 2) * 5;
                const x = Math.cos(angle) * distance;
                const y = Math.sin(angle) * distance;
                const toneClass = item.tone === 'accent'
                  ? 'border-emerald-300/70 bg-emerald-300 text-black'
                  : 'border-white/20 bg-zinc-900/95';

                return (
                  <motion.div
                    key={item.label}
                    className="absolute left-1/2 top-1/2"
                    variants={{
                      closed: { x: 0, y: 0, scale: 0, opacity: 0 },
                      open: { x, y, scale: 1, opacity: 1 },
                    }}
                    transition={{ type: 'spring', stiffness: 330, damping: 22, delay: index * 0.035 }}
                    style={{ transform: 'translate(-50%, -50%)' }}
                  >
                    <button
                      type="button"
                      onClick={() => handleItemClick(item)}
                      className={'group relative flex size-12 items-center justify-center rounded-full border text-foreground shadow-xl backdrop-blur-xl transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ' + toneClass}
                      aria-label={item.label}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                      <span className="pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-md bg-foreground px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-background opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                        {item.label}
                      </span>
                    </button>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          type="button"
          aria-label={open ? 'Close quick actions' : label}
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.92 }}
          className="relative z-10 flex size-14 items-center justify-center rounded-full border border-white/25 bg-foreground text-background shadow-2xl shadow-black/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <motion.span animate={{ rotate: open ? 45 : 0 }} transition={{ type: 'spring', stiffness: 400, damping: 18 }}>
            {open ? <X className="size-5" /> : <Plus className="size-5" />}
          </motion.span>
          <span className="sr-only">{open ? 'Close quick actions' : label}</span>
        </motion.button>
      </div>
    </div>
  );
}
