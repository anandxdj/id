'use client';

import { useState } from 'react';
import * as adminApi from '@/features/admin/services/adminApi';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const STACKS = [
  { id: 'nextjs', label: 'Next.js' },
  { id: 'express', label: 'Express' },
  { id: 'python', label: 'Python' },
];

/**
 * Shows the LLM config-prompt for a client with a stack selector. Re-fetches per
 * stack from the backend so the wiring guidance matches. Secret stays a placeholder.
 */
export function ConfigPromptBlock({ clientId, initialPrompt }: { clientId: string; initialPrompt: string }) {
  const [stack, setStack] = useState('nextjs');
  const [prompt, setPrompt] = useState(initialPrompt);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function pick(next: string) {
    if (next === stack) return;
    setStack(next);
    setLoading(true);
    try {
      setPrompt(await adminApi.getConfigPrompt(clientId, next));
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1">
          {STACKS.map((s) => (
            <button
              key={s.id}
              onClick={() => pick(s.id)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs transition-colors',
                stack === s.id ? 'bg-white text-black' : 'bg-white/10 text-white/70 hover:bg-white/20',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <Button variant="secondary" className="h-8 px-3 text-xs" onClick={copy}>
          {copied ? 'Copied' : 'Copy prompt'}
        </Button>
      </div>
      <pre className={cn('max-h-96 overflow-auto rounded-xl border border-white/10 bg-black/40 p-4 text-xs leading-relaxed text-white/80', loading && 'opacity-50')}>
        {prompt}
      </pre>
      <p className="text-xs text-white/40">
        Paste this into your coding agent inside the relying-party repo to wire up the OIDC client.
      </p>
    </div>
  );
}
