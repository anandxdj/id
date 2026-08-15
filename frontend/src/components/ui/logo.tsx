import Image from 'next/image';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  imageClassName?: string;
  size?: number;
}

export function Logo({
  className,
  imageClassName,
  size = 48,
}: LogoProps) {
  return (
    <div className={cn('relative inline-flex items-center justify-center shrink-0 select-none group', className)}>
      {/* Light mode logo */}
      <Image
        src="/logo/light_logo.png"
        alt="ID Logo"
        width={size}
        height={size}
        className={cn(
          'dark:hidden object-contain transition-transform duration-300 group-hover:scale-105',
          imageClassName
        )}
        style={{ width: size, height: size }}
        priority
      />
      {/* Dark mode logo */}
      <Image
        src="/logo/dark_logo.png"
        alt="ID Logo"
        width={size}
        height={size}
        className={cn(
          'hidden dark:block object-contain transition-transform duration-300 group-hover:scale-105',
          imageClassName
        )}
        style={{ width: size, height: size }}
        priority
      />
    </div>
  );
}

