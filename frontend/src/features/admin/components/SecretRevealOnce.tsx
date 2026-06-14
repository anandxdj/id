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
    <div className="border-2 border-warn bg-warn/10 p-4">
      <p className="font-mono text-xs font-bold uppercase tracking-wide text-warn">{label}</p>
      <div className="mt-2 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate border-2 border-border bg-card px-3 py-2 font-mono text-sm text-foreground">{value}</code>
        <Button size="sm" className="shrink-0" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <p className="mt-2 font-mono text-xs font-bold uppercase text-warn">
        Store this now — it will not be shown again. Save it to your secret manager, not in chat.
      </p>
    </div>
  );
}
