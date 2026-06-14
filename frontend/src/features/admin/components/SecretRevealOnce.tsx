'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

/** One-time reveal of a freshly created/rotated secret. It is never fetchable again. */
export function SecretRevealOnce({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-4">
      <p className="text-xs font-medium text-amber-300">{label}</p>
      <div className="mt-2 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded bg-black/40 px-3 py-2 font-mono text-sm text-white">{value}</code>
        <Button variant="secondary" className="h-9 shrink-0 px-3 text-xs" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <p className="mt-2 text-xs text-amber-200/70">
        Store this now — it will not be shown again. Save it to your secret manager, not in chat.
      </p>
    </div>
  );
}
