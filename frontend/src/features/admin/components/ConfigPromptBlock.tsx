'use client';

import { useState } from 'react';
import * as adminApi from '@/features/admin/services/adminApi';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const STACKS = {
  web: [
    { id: 'nextjs', label: 'Next.js' },
    { id: 'express', label: 'Express' },
    { id: 'python', label: 'Python' },
  ],
  spa: [
    { id: 'react', label: 'React' },
    { id: 'vue', label: 'Vue' },
    { id: 'angular', label: 'Angular' },
  ],
  native: [
    { id: 'react-native', label: 'React Native' },
    { id: 'flutter', label: 'Flutter' },
    { id: 'ios', label: 'iOS' },
    { id: 'android', label: 'Android' },
  ],
} as const;

/**
 * Shows the LLM config-prompt for a client with a stack selector. Re-fetches per
 * stack from the backend so the wiring guidance matches. Secret stays a placeholder.
 */
export function ConfigPromptBlock({
  clientId,
  initialPrompt,
  initialStack = 'nextjs',
  appType = 'web',
}: {
  clientId: string;
  initialPrompt: string;
  initialStack?: string;
  appType?: keyof typeof STACKS;
}) {
  const [stack, setStack] = useState(initialStack);
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
          {STACKS[appType].map((s) => (
            <button
              key={s.id}
              onClick={() => pick(s.id)}
              className={cn(
                'border-2 border-border px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wide transition-colors',
                stack === s.id
                  ? 'bg-brand text-brand-foreground'
                  : 'bg-card text-muted-foreground hover:text-foreground',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <Button variant="secondary" size="sm" onClick={copy}>
          {copied ? 'Copied' : 'Copy prompt'}
        </Button>
      </div>
      <pre className={cn('max-h-96 overflow-auto rounded-xl border border-border bg-card p-4 font-mono text-xs leading-relaxed text-foreground shadow-brutal-sm', loading && 'opacity-50')}>
        {prompt}
      </pre>
      <p className="font-mono text-xs text-muted-foreground">
        Paste this into your coding agent inside the relying-party repo to wire up the OIDC client.
      </p>
    </div>
  );
}
