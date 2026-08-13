import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-10.5 w-full border border-input/60 bg-card/50 backdrop-blur-sm px-3 text-sm text-foreground rounded-lg shadow-xs transition-all',
        'placeholder:text-muted-foreground/80',
        'focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
