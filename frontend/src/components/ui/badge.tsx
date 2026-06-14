import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'default' | 'ok' | 'danger' | 'warn' | 'muted';

const tones: Record<Tone, string> = {
  default: 'bg-brand text-brand-foreground border-border',
  ok: 'bg-ok text-ok-foreground border-border',
  danger: 'bg-danger text-danger-foreground border-border',
  warn: 'bg-warn text-warn-foreground border-border',
  muted: 'bg-muted text-muted-foreground border-border',
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ className, tone = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center border-2 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
