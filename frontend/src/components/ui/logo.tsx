import Image from 'next/image';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  imageClassName?: string;
  /** Tailwind classes sizing the mark. When set, `size` is used only as the
   *  intrinsic hint for `next/image` and no fixed pixel box is applied. */
  markClassName?: string;
  size?: number;
  /** Render the "OID" wordmark beside the mark, as in the Figma lockup. */
  wordmark?: boolean;
  wordmarkClassName?: string;
}

export function Logo({
  className,
  imageClassName,
  markClassName,
  size = 48,
  wordmark = false,
  wordmarkClassName,
}: LogoProps) {
  const markStyle = markClassName ? undefined : { width: size, height: size };
  const imageClasses = cn(
    'size-full object-contain transition-transform duration-300 group-hover:scale-105',
    imageClassName
  );

  return (
    <div
      className={cn(
        'group relative inline-flex shrink-0 select-none items-center justify-center',
        wordmark && 'gap-2',
        className
      )}
    >
      <span className={cn('relative block shrink-0', markClassName)} style={markStyle}>
        {/* Light mode logo */}
        <Image
          src="/logo/light_logo.png"
          alt={wordmark ? '' : 'OID logo'}
          width={size}
          height={size}
          className={cn('dark:hidden', imageClasses)}
          priority
        />
        {/* Dark mode logo */}
        <Image
          src="/logo/dark_logo.png"
          alt={wordmark ? '' : 'OID logo'}
          width={size}
          height={size}
          className={cn('hidden dark:block', imageClasses)}
          priority
        />
      </span>

      {wordmark ? (
        <span
          className={cn(
            'font-heading font-black leading-none tracking-tight',
            wordmarkClassName
          )}
        >
          OID
        </span>
      ) : null}
    </div>
  );
}
