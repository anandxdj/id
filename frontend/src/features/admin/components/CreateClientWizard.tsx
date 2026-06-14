'use client';

import { useState } from 'react';
import Link from 'next/link';
import * as adminApi from '@/features/admin/services/adminApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SecretRevealOnce } from '@/features/admin/components/SecretRevealOnce';
import { ConfigPromptBlock } from '@/features/admin/components/ConfigPromptBlock';
import type { CreatedClient } from '@/types';

export function CreateClientWizard() {
  const [clientName, setClientName] = useState('');
  const [redirectUris, setRedirectUris] = useState('');
  const [description, setDescription] = useState('');
  const [stack, setStack] = useState('nextjs');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<CreatedClient | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const uris = redirectUris
      .split(/[\n,]/)
      .map((u) => u.trim())
      .filter(Boolean);
    if (uris.length === 0) {
      setError('At least one redirect URI is required.');
      return;
    }
    setCreating(true);
    try {
      const result = await adminApi.createClient({ clientName, redirectUris: uris, description: description || undefined, stack });
      setCreated(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  if (created) {
    return (
      <div className="space-y-6">
        <div className="border-2 border-ok bg-ok/10 p-4">
          <p className="font-mono text-sm font-bold uppercase tracking-wide text-ok">
            App “{created.clientName}” created
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Client ID: <code className="font-mono text-foreground">{created.clientId}</code>
          </p>
        </div>
        <SecretRevealOnce label="Client secret (shown once)" value={created.clientSecret} />
        <div>
          <h3 className="eyebrow mb-2 text-muted-foreground">[ LLM_CONFIG_PROMPT ]</h3>
          <ConfigPromptBlock clientId={created.clientId} initialPrompt={created.configPrompt} />
        </div>
        <div className="flex gap-2">
          <Link href="/admin/apps">
            <Button variant="secondary">Done</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="max-w-lg space-y-4">
      <div>
        <Label>App name</Label>
        <Input value={clientName} onChange={(e) => setClientName(e.target.value)} required minLength={2} placeholder="My Internal App" />
      </div>
      <div>
        <Label>Redirect URIs</Label>
        <textarea
          value={redirectUris}
          onChange={(e) => setRedirectUris(e.target.value)}
          rows={3}
          placeholder={'https://app.example.com/api/auth/callback\nhttp://localhost:3000/api/auth/callback'}
          className="w-full border-2 border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
        />
        <p className="mt-1 font-mono text-xs text-muted-foreground">One per line (or comma-separated).</p>
      </div>
      <div>
        <Label>Description (optional)</Label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this app is" />
      </div>
      <div>
        <Label>Initial config-prompt stack</Label>
        <select
          value={stack}
          onChange={(e) => setStack(e.target.value)}
          className="h-11 w-full border-2 border-input bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
        >
          <option value="nextjs">Next.js</option>
          <option value="express">Express</option>
          <option value="python">Python</option>
        </select>
      </div>
      {error && <p className="font-mono text-sm text-danger">{error}</p>}
      <Button type="submit" disabled={creating}>
        {creating ? 'Creating…' : 'Create app'}
      </Button>
    </form>
  );
}
