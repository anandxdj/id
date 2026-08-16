'use client';

import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Drawer({ isOpen, onClose, title, children }: DrawerProps) {
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
        onClick={onClose}
      />

      {/* Slide-out Panel */}
      <div
        className="relative z-10 flex h-full w-full max-w-lg flex-col border-l-2 border-border bg-card shadow-2xl transition-transform duration-300 ease-out animate-in slide-in-from-right"
        role="dialog"
        aria-modal="true"
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b-2 border-border bg-muted/30 px-6 py-4">
          <h2 className="font-heading text-lg font-bold tracking-tight text-foreground">{title}</h2>
          <button
            onClick={onClose}
            className="border-2 border-border bg-background p-1.5 text-muted-foreground hover:text-foreground hover:shadow-brutal-xs transition-all cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          {children}
        </div>
      </div>
    </div>
  );
}
