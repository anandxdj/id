import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Compact relative time, e.g. "3m ago", "2d ago", or "never". */
export function timeAgo(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === 0) return 'never';
  const then = typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(then)) return '—';
  const secs = Math.round((Date.now() - then) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(then).toLocaleDateString();
}
