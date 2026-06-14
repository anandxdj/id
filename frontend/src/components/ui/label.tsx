import type { LabelHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        'mb-1.5 block font-mono text-[11px] font-bold uppercase tracking-wide text-foreground',
        className,
      )}
      {...props}
    />
  );
}
