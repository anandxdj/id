'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Globe2,
  Info,
  Laptop,
  Plus,
  Server,
  ShieldCheck,
  Smartphone,
  Trash2,
} from 'lucide-react';
import * as adminApi from '@/features/admin/services/adminApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SecretRevealOnce } from '@/features/admin/components/SecretRevealOnce';
import { ConfigPromptBlock } from '@/features/admin/components/ConfigPromptBlock';
import { cn } from '@/lib/utils';
import type { CreatedClient } from '@/types';

type AppType = 'web' | 'spa' | 'native';

const APP_TYPES = [
  {
    id: 'web' as const,
    icon: Server,
    title: 'Web application',
    short: 'Runs on a server',
    description: 'Next.js, Express, Django, Rails, or another app that can keep a client secret private.',
    authMethod: 'client_secret_basic' as const,
    stack: 'react',
    redirect: 'http://localhost:3000/api/auth/callback/id',
    examples: 'Next.js · Express · Python',
  },
  {
    id: 'spa' as const,
    icon: Laptop,
    title: 'Single-page app',
    short: 'Runs in the browser',
    description: 'React, Vue, Angular, or another browser-only app. Uses PKCE and never receives a secret.',
    authMethod: 'none' as const,
    stack: 'nextjs',
    redirect: 'http://localhost:3000/auth/callback',
    examples: 'React · Vue · Angular',
  },
  {
    id: 'native' as const,
    icon: Smartphone,
    title: 'Native / mobile app',
    short: 'Runs on a device',
    description: 'React Native, Flutter, iOS, or Android. Uses the system browser and PKCE without a client secret.',
    authMethod: 'none' as const,
    stack: 'react-native',
    redirect: 'com.example.app:/oauth/callback',
    examples: 'React Native · Flutter · Swift · Kotlin',
  },
] as const;

const STACKS_BY_TYPE = {
  web: [
    { value: 'nextjs', label: 'Next.js' },
    { value: 'express', label: 'Express / Node.js' },
    { value: 'python', label: 'Python / Django / FastAPI' },
  ],
  spa: [
    { value: 'react', label: 'React' },
    { value: 'vue', label: 'Vue' },
    { value: 'angular', label: 'Angular' },
  ],
  native: [
    { value: 'react-native', label: 'React Native / Expo' },
    { value: 'flutter', label: 'Flutter' },
    { value: 'ios', label: 'iOS / Swift' },
    { value: 'android', label: 'Android / Kotlin' },
  ],
} as const;

function StepMarker({ number, label, active, complete }: { number: number; label: string; active: boolean; complete: boolean }) {
  return (
    <div className={cn('flex items-center gap-2', !active && !complete && 'text-muted-foreground')}>
      <span
        className={cn(
          'flex size-6 items-center justify-center rounded-full border font-mono text-[10px] font-bold',
          active && 'border-foreground bg-foreground text-background',
          complete && 'border-ok bg-ok text-ok-foreground',
        )}
      >
        {complete ? <Check className="size-3.5" /> : number}
      </span>
      <span className="hidden text-xs font-medium sm:inline">{label}</span>
    </div>
  );
}

export function CreateClientWizard() {
  const [step, setStep] = useState<1 | 2>(1);
  const [appType, setAppType] = useState<AppType>('web');
  const [clientName, setClientName] = useState('');
  const [redirectUris, setRedirectUris] = useState<string[]>([APP_TYPES[0].redirect]);
  const [postLogoutRedirectUris, setPostLogoutRedirectUris] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [stack, setStack] = useState('nextjs');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<CreatedClient | null>(null);

  const selectedType = useMemo(() => APP_TYPES.find((type) => type.id === appType)!, [appType]);
  const selectedStacks = STACKS_BY_TYPE[appType];

  function chooseType(type: (typeof APP_TYPES)[number]) {
    setAppType(type.id);
    setStack(type.stack);
    setRedirectUris((current) => {
      const priorDefaults = APP_TYPES.map((item) => item.redirect);
      return current.length === 0 || (current.length === 1 && priorDefaults.includes(current[0] as never))
        ? [type.redirect]
        : current;
    });
  }

  function updateUri(index: number, value: string) {
    setRedirectUris((items) => items.map((item, itemIndex) => (itemIndex === index ? value : item)));
  }

  function removeUri(index: number) {
    setRedirectUris((items) => items.filter((_, itemIndex) => itemIndex !== index));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const uris = redirectUris.map((uri) => uri.trim()).filter(Boolean);
    if (uris.length === 0) {
      setError('Add at least one redirect URI so users can return to your app.');
      return;
    }
    setCreating(true);
    try {
      const result = await adminApi.createClient({
        clientName: clientName.trim(),
        redirectUris: uris,
        description: description.trim() || undefined,
        logoUrl: logoUrl.trim() || undefined,
        stack,
        scopes: ['openid', 'profile', 'email'],
        grantTypes: ['authorization_code'],
        responseTypes: ['code'],
        tokenEndpointAuthMethod: selectedType.authMethod,
        postLogoutRedirectUris: postLogoutRedirectUris.map((uri) => uri.trim()).filter(Boolean),
      });
      setCreated(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  if (created) {
    const isPublic = !created.clientSecret;
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-2xl border border-ok/40 bg-ok/10 p-6">
          <div className="flex items-start gap-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ok text-ok-foreground">
              <Check className="size-5" />
            </span>
            <div>
              <p className="text-lg font-semibold">{created.clientName} is ready</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {isPublic
                  ? 'This public client uses PKCE and has no client secret to leak.'
                  : 'Copy the secret now. It cannot be shown again.'}
              </p>
              <code className="mt-3 block break-all font-mono text-xs">{created.clientId}</code>
            </div>
          </div>
        </div>
        {created.clientSecret && <SecretRevealOnce label="Client secret (shown once)" value={created.clientSecret} />}
        <div>
          <h3 className="eyebrow mb-2 text-muted-foreground">[ IMPLEMENTATION_GUIDE ]</h3>
          <ConfigPromptBlock
            clientId={created.clientId}
            initialPrompt={created.configPrompt}
            initialStack={stack}
            appType={appType}
          />
        </div>
        <Link href="/admin/apps"><Button variant="secondary">Done</Button></Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-7 flex items-center justify-between border-b pb-5">
        <div className="flex items-center gap-4 sm:gap-8">
          <StepMarker number={1} label="Choose app type" active={step === 1} complete={step > 1} />
          <div className="h-px w-8 bg-border sm:w-16" />
          <StepMarker number={2} label="Configure app" active={step === 2} complete={false} />
        </div>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Step {step} of 2</span>
      </div>

      {step === 1 ? (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Where does your app run?</h2>
            <p className="mt-1 text-sm text-muted-foreground">We’ll choose the safest OAuth settings for its environment.</p>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {APP_TYPES.map((type) => {
              const Icon = type.icon;
              const selected = type.id === appType;
              return (
                <button
                  type="button"
                  key={type.id}
                  onClick={() => chooseType(type)}
                  className={cn(
                    'group relative flex min-h-64 flex-col rounded-2xl border p-5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    selected ? 'border-foreground bg-foreground text-background shadow-brutal-lg' : 'bg-card hover:-translate-y-1 hover:border-foreground/40 hover:shadow-brutal',
                  )}
                >
                  <span className={cn('mb-8 flex size-11 items-center justify-center rounded-xl border', selected ? 'border-background/25 bg-background/10' : 'bg-muted')}>
                    <Icon className="size-5" />
                  </span>
                  <span className="text-base font-semibold">{type.title}</span>
                  <span className={cn('mt-1 text-xs font-medium', selected ? 'text-background/65' : 'text-muted-foreground')}>{type.short}</span>
                  <p className={cn('mt-4 text-sm leading-6', selected ? 'text-background/75' : 'text-muted-foreground')}>{type.description}</p>
                  <span className={cn('mt-auto pt-6 font-mono text-[10px] uppercase tracking-wider', selected ? 'text-background/55' : 'text-muted-foreground')}>{type.examples}</span>
                  {selected && <span className="absolute right-4 top-4 flex size-6 items-center justify-center rounded-full bg-background text-foreground"><Check className="size-3.5" /></span>}
                </button>
              );
            })}
          </div>
          <div className="flex justify-end">
            <Button type="button" size="lg" onClick={() => setStep(2)}>Configure this app <ArrowRight className="size-4" /></Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="overflow-hidden rounded-2xl border bg-card">
            <div className="border-b p-5 sm:p-6">
              <div className="mb-5 flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-foreground text-background"><selectedType.icon className="size-4" /></span>
                <div><h2 className="font-semibold">{selectedType.title}</h2><p className="text-xs text-muted-foreground">{selectedType.short}</p></div>
                <button type="button" onClick={() => setStep(1)} className="ml-auto text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Change type</button>
              </div>
              <div className="space-y-4">
                <div><Label htmlFor="client-name">App name</Label><Input id="client-name" className="mt-1.5" value={clientName} onChange={(e) => setClientName(e.target.value)} required minLength={2} placeholder="Acme dashboard" /></div>
                <div><Label htmlFor="description">Description <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="description" className="mt-1.5" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Who uses this app and what it does" /></div>
              </div>
            </div>

            <div className="border-b p-5 sm:p-6">
              <div className="mb-4"><h3 className="text-sm font-semibold">{appType === 'native' ? 'App callback URIs' : 'Redirect URIs'}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{appType === 'native' ? 'The deep link or universal link that reopens your app after sign-in. It must also be registered in the native project.' : 'Exact URLs users may return to after signing in. Add production and local development separately.'}</p></div>
              <div className="space-y-2">
                {redirectUris.map((uri, index) => (
                  <div key={index} className="flex gap-2">
                    <div className="relative flex-1"><Globe2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label={`Redirect URI ${index + 1}`} className="pl-9 font-mono text-xs" value={uri} onChange={(e) => updateUri(index, e.target.value)} placeholder={selectedType.redirect} /></div>
                    <button type="button" onClick={() => removeUri(index)} disabled={redirectUris.length === 1} aria-label="Remove redirect URI" className="flex size-10.5 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:border-danger hover:text-danger disabled:opacity-30"><Trash2 className="size-4" /></button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setRedirectUris((items) => [...items, ''])} className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium hover:underline"><Plus className="size-3.5" /> Add another URI</button>
            </div>

            <div className="p-5 sm:p-6">
              <button type="button" onClick={() => setShowAdvanced((value) => !value)} className="flex w-full items-center justify-between rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span><span className="block text-sm font-semibold">Setup preferences</span><span className="mt-1 block text-xs text-muted-foreground">Tailor the generated guide and optional app details</span></span><ChevronDown className={cn('size-4 transition-transform', showAdvanced && 'rotate-180')} /></button>
              {showAdvanced && (
                <div className="mt-5 grid gap-4 border-t pt-5 sm:grid-cols-2">
                  <div><Label htmlFor="stack">Built with</Label><select id="stack" value={stack} onChange={(e) => setStack(e.target.value)} className="mt-1.5 h-10.5 w-full rounded-lg border border-input bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">{selectedStacks.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">Used only to tailor your implementation guide.</p></div>
                  <div><Label htmlFor="logo">Logo URL <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="logo" className="mt-1.5" type="url" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://example.com/logo.svg" /></div>
                  <div className="sm:col-span-2"><Label htmlFor="logout-uri">Return after sign-out <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="logout-uri" className="mt-1.5 font-mono text-xs" value={postLogoutRedirectUris[0] ?? ''} onChange={(e) => setPostLogoutRedirectUris(e.target.value ? [e.target.value] : [])} placeholder={appType === 'native' ? 'com.example.app:/signed-out' : 'https://example.com/signed-out'} /><p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">Where the user should land after signing out of the identity provider.</p></div>
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-2xl border bg-muted/35 p-5">
              <div className="mb-4 flex items-center gap-2"><ShieldCheck className="size-4" /><h3 className="text-sm font-semibold">Security profile</h3></div>
              <dl className="space-y-3 text-xs">
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">OAuth flow</dt><dd className="text-right font-medium">Authorization code</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">PKCE</dt><dd className="font-medium">Required</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Client secret</dt><dd className="font-medium">{selectedType.authMethod === 'none' ? 'None' : 'Generated once'}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Scopes</dt><dd className="text-right font-mono text-[10px]">openid profile email</dd></div>
              </dl>
            </div>
            <div className="flex gap-3 rounded-xl border border-warn/40 bg-warn/10 p-4 text-xs leading-5"><Info className="mt-0.5 size-4 shrink-0" /><p>{selectedType.authMethod === 'none' ? 'Public apps authenticate with PKCE. Never embed a client secret in browser or installed-app code.' : 'Keep the generated secret on your server. Never expose it through browser code or public environment variables.'}</p></div>
            {error && <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm text-danger">{error}</p>}
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setStep(1)} aria-label="Back to app type"><ArrowLeft className="size-4" /></Button>
              <Button type="submit" className="flex-1" disabled={creating || clientName.trim().length < 2}>{creating ? 'Creating…' : 'Create app'} {!creating && <ArrowRight className="size-4" />}</Button>
            </div>
          </aside>
        </form>
      )}
    </div>
  );
}
