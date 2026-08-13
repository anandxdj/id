import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  /** brutalist "[ 01_SECTION ]" eyebrow tag rendered in the top border */
  label?: ReactNode;
  /** optional right-aligned content in the header strip */
  action?: ReactNode;
}

/** Bordered brutalist box with an optional mono eyebrow header strip. */
export function Panel({ className, label, action, children, ...props }: PanelProps) {
  return (
    <div
      className={cn('border border-border/50 bg-card/70 backdrop-blur-md shadow-md rounded-xl overflow-hidden', className)}
      {...props}
    >
      {(label || action) && (
        <div className="flex items-center justify-between gap-2 border-b border-border/40 px-5 py-3">
          {label ? <span className="eyebrow text-muted-foreground/80">{label}</span> : <span />}
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}
