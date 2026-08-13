import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'default' | 'ok' | 'danger' | 'warn' | 'muted';

const tones: Record<Tone, string> = {
  default: 'bg-brand/10 text-brand border-brand/20',
  ok: 'bg-ok/10 text-ok-foreground border-ok/20 dark:text-emerald-400',
  danger: 'bg-danger/10 text-danger border-danger/20',
  warn: 'bg-warn/10 text-warn-foreground border-warn/20 dark:text-amber-400',
  muted: 'bg-muted text-muted-foreground border-border/50',
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ className, tone = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[14px_6px_14px_6px] border px-2.5 py-0.5 font-sans text-[11px] font-medium transition-all duration-200 hover:scale-105',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
