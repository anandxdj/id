'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

type PaginationProps = {
  page: number;
  pageSize: number;
  count: number;
  total?: number;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious(): void;
  onNext(): void;
  loading?: boolean;
  noun?: string;
};

export function Pagination({
  page,
  pageSize,
  count,
  total,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  loading = false,
  noun = 'items',
}: PaginationProps) {
  if (!hasPrevious && !hasNext) return null;

  const start = (page - 1) * pageSize + 1;
  const end = start + Math.max(count - 1, 0);
  const range = total === undefined
    ? `${start}${end} ${noun}`
    : `${start}${Math.min(end, total)} of ${total} ${noun}`;

  return (
    <nav
      aria-label={`${noun} pagination`}
      className="flex flex-col gap-3 border-t border-border/50 pt-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
        Page {page} <span aria-hidden="true">�</span> {range}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!hasPrevious || loading}
          onClick={onPrevious}
          aria-label={`Previous page of ${noun}`}
        >
          <ChevronLeft className="size-3.5" aria-hidden="true" />
          Previous
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!hasNext || loading}
          onClick={onNext}
          aria-label={`Next page of ${noun}`}
        >
          Next
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
