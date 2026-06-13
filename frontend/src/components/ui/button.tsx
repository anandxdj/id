import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const variants: Record<Variant, string> = {
  primary: 'bg-white text-black hover:bg-white/90 disabled:opacity-50',
  secondary: 'bg-white/10 text-white hover:bg-white/20 disabled:opacity-50',
  ghost: 'bg-transparent text-white/70 hover:text-white',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex h-11 items-center justify-center rounded-lg px-5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-white/30 disabled:cursor-not-allowed',
        variants[variant],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
