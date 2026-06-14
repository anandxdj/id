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
      className={cn('border-2 border-border bg-card shadow-brutal', className)}
      {...props}
    >
      {(label || action) && (
        <div className="flex items-center justify-between gap-2 border-b-2 border-border px-4 py-2.5">
          {label ? <span className="eyebrow text-muted-foreground">{label}</span> : <span />}
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}
