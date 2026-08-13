'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, Calendar, Key, AlertCircle } from 'lucide-react';
import * as accountApi from '@/features/account/services/accountApi';
import { Button } from '@/components/ui/button';
import { timeAgo } from '@/lib/utils';
import type { AuthorizedApp } from '@/types';

interface UserGrantsProps {
  onAppsChanged?: (count: number) => void;
  mode: 'user' | 'dev';
}

function getFriendlyPermissions(scope: string): string {
  const parts = scope.split(/[\s+]+/);
  const friendly: string[] = [];
  if (parts.includes('openid') || parts.includes('profile')) {
    friendly.push('Basic profile info (Name, Avatar)');
  }
  if (parts.includes('email')) {
    friendly.push('Email address');
  }
  if (parts.includes('offline_access')) {
    friendly.push('Background refresh access');
  }
  return friendly.length > 0 ? friendly.join(', ') : scope;
}

export function UserGrants({ onAppsChanged, mode }: UserGrantsProps) {
  const [apps, setApps] = useState<AuthorizedApp[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const isDev = mode === 'dev';

  useEffect(() => {
    accountApi.listApps()
      .then((data) => {
        setApps(data);
        onAppsChanged?.(data.length);
      })
      .catch((e) => setError(e.message));
  }, [onAppsChanged]);

  async function revoke(clientId: string) {
    if (!confirm(isDev 
      ? 'Revoke access for this client? Active access tokens will be blacklisted.' 
      : 'Disconnect this application? You will be signed out of it.')) return;
    setBusy(clientId);
    try {
      await accountApi.revokeApp(clientId);
      const remainingApps = apps?.filter((a) => a.clientId !== clientId) ?? [];
      setApps(remainingApps);
      onAppsChanged?.(remainingApps.length);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (error) {
    return (
      <section id="grants" className="relative z-10 mx-auto max-w-6xl px-6 py-12 border-t-2 border-border">
        <div className="border-2 border-border bg-danger-foreground text-danger p-4 flex items-center gap-3">
          <AlertCircle className="size-5" />
          <p className="font-mono text-sm">Failed to retrieve connected apps: {error}</p>
        </div>
      </section>
    );
  }

  if (!apps) {
    return (
      <section id="grants" className="relative z-10 mx-auto max-w-6xl px-6 py-12 border-t-2 border-border">
        <p className="eyebrow text-muted-foreground text-center animate-pulse">LOADING AUTHORIZED SESSIONS…</p>
      </section>
    );
  }

  return (
    <section id="grants" className="relative z-10 mx-auto max-w-6xl px-6 py-16 border-t-2 border-border">
      <div className="border-b-2 border-border pb-6 mb-8">
        <span className="eyebrow text-muted-foreground">
          {isDev ? '[ 02_AUTHORIZED_CLIENTS_AND_GRANTS ]' : '[ 02_CONNECTED_APPLICATIONS ]'}
        </span>
        <h2 className="font-heading text-3xl font-bold tracking-tight mt-1 text-foreground">
          {isDev ? 'OIDC GRANTS & ACTIVE CLIENTS' : 'CONNECTED WEBSITES & APPS'}
        </h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-lg">
          {isDev
            ? 'These are the OAuth client applications holding active access/refresh tokens. Revoking deletes consents and tokens.'
            : 'These are the websites and applications you have logged into. You can disconnect them at any time.'}
        </p>
      </div>

      {apps.length === 0 ? (
        <div className="border-2 border-dashed border-border p-12 text-center bg-card shadow-brutal-sm">
          <ShieldCheck className="size-10 text-muted-foreground mx-auto mb-4" />
          <p className="font-heading font-bold text-foreground">No active connections found</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
            You haven&apos;t logged into any applications yet. Use the Launchpad above to connect.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {apps.map((app) => (
            <div
              key={app.clientId}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-2 border-border bg-card/90 backdrop-blur-md p-5 shadow-brutal transition-all duration-300 hover:-translate-x-0.5 hover:-translate-y-1 hover:shadow-brutal-sm"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-heading font-black text-foreground text-base md:text-lg">{app.clientName}</h3>
                  {isDev && (
                    <span className="font-mono text-[9px] text-muted-foreground bg-muted border border-border/40 px-1 py-0.5">
                      {app.clientId}
                    </span>
                  )}
                </div>
                
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Key className="size-3.5 text-brand" />
                    <span>
                      {isDev ? 'Scopes: ' : 'Permissions: '}
                      <strong className="font-heading text-foreground font-bold text-[11px]">
                        {isDev ? app.scope : getFriendlyPermissions(app.scope)}
                      </strong>
                    </span>
                  </div>
                  {app.lastUsedAt && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="size-3.5 text-brand" />
                      <span>Last active: <strong className="text-foreground">{timeAgo(app.lastUsedAt)}</strong></span>
                    </div>
                  )}
                </div>
              </div>

              <div className="shrink-0 flex items-center justify-end border-t border-border/40 sm:border-0 pt-3 sm:pt-0">
                <Button
                  variant="danger"
                  size="sm"
                  className="shadow-brutal-xs"
                  disabled={busy === app.clientId}
                  onClick={() => revoke(app.clientId)}
                >
                  {busy === app.clientId ? 'Disconnecting…' : 'Disconnect'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
