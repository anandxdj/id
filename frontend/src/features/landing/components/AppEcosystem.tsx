'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ExternalLink, Terminal, ShieldAlert, BookOpen, BarChart3, Database, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import * as accountApi from '@/features/account/services/accountApi';
import type { User, AuthorizedApp } from '@/types';

// Curated list of Anand's internal applications with descriptions.
const APPS = [
  {
    clientId: 'cl_example_app',
    clientName: 'Example Internal App',
    userDescription: 'A playground site to check your session login status and verify how your single sign-on works.',
    redirectUri: 'http://localhost:3001/api/auth/callback/id',
    category: 'Development',
    icon: Terminal,
    color: 'bg-emerald-500',
  },
  {
    clientId: 'cl_analytics_console',
    clientName: 'Analytics & Monitoring',
    userDescription: 'View real-time statistics, visit trackers, and server health logs across all of Anand\'s projects.',
    redirectUri: 'http://localhost:3002/auth/callback',
    category: 'Infrastructure',
    icon: BarChart3,
    color: 'bg-indigo-500',
  },
  {
    clientId: 'cl_dev_wiki',
    clientName: 'Dev Wiki & Docs',
    userDescription: 'Search central documentation, guides, server configurations, and general developer notes.',
    redirectUri: 'http://localhost:3003/api/callback',
    category: 'Knowledge',
    icon: BookOpen,
    color: 'bg-amber-500',
  },
  {
    clientId: 'cl_cluster_db',
    clientName: 'Cluster Database Admin',
    userDescription: 'Explore, manage, and schedule backups for local Mongo + Redis databases safely.',
    redirectUri: 'http://localhost:3004/oidc/callback',
    category: 'Database',
    icon: Database,
    color: 'bg-rose-500',
  },
];

function getBaseUrl(redirectUri: string): string {
  try {
    const url = new URL(redirectUri);
    return `${url.protocol}//${url.host}`;
  } catch {
    return '#';
  }
}

interface AppEcosystemProps {
  user: User | null;
  onAppsChanged?: (count: number) => void;
}

export function AppEcosystem({ user, onAppsChanged }: AppEcosystemProps) {
  const [consents, setConsents] = useState<AuthorizedApp[]>([]);
  const [filter, setFilter] = useState<string>('ALL');
  const [busy, setBusy] = useState<string | null>(null);

  const categories = ['ALL', ...Array.from(new Set(APPS.map((a) => a.category.toUpperCase())))];

  // Fetch active OIDC consents from the backend
  useEffect(() => {
    if (user) {
      accountApi.listApps()
        .then((data) => {
          setConsents(data);
          onAppsChanged?.(data.length);
        })
        .catch((e) => console.error('Failed to load OIDC consents:', e));
    }
  }, [user, onAppsChanged]);

  const handleRevoke = async (clientId: string, clientName: string) => {
    if (!confirm(`Disconnect from ${clientName}? You will be logged out of it.`)) return;
    setBusy(clientId);
    try {
      await accountApi.revokeApp(clientId);
      const remaining = consents.filter((c) => c.clientId !== clientId);
      setConsents(remaining);
      onAppsChanged?.(remaining.length);
    } catch (e) {
      alert(`Failed to disconnect: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const filteredApps = filter === 'ALL'
    ? APPS
    : APPS.filter((app) => app.category.toUpperCase() === filter);

  return (
    <div className="space-y-6">
      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-border/40 pb-4">
        {categories.map((cat) => {
          const isActive = filter === cat;
          return (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={cn(
                'relative eyebrow border px-3 py-1.5 text-xs font-semibold cursor-pointer rounded-lg overflow-hidden transition-all duration-300',
                isActive
                  ? 'text-brand-foreground border-transparent shadow-sm'
                  : 'bg-card text-muted-foreground border-border/50 hover:text-foreground hover:bg-accent/30'
              )}
            >
              {isActive && (
                <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden" style={{ filter: 'url(#gooey-global)' }}>
                  <motion.div
                    layoutId="activeCategoryBg"
                    transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                    className="absolute inset-0 bg-brand"
                  />
                  <motion.div
                    className="bg-brand size-3 rounded-full absolute top-[30%]"
                    initial={{ left: '10%' }}
                    animate={{ left: '45%' }}
                    transition={{ type: 'spring', stiffness: 200, damping: 22 }}
                  />
                </div>
              )}
              <span className="relative z-10">{cat}</span>
            </button>
          );
        })}
      </div>

      {/* Applications Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-1">
        {filteredApps.map((app) => {
          const appUrl = getBaseUrl(app.redirectUri);
          const consent = consents.find((c) => c.clientId === app.clientId);
          const isConnected = !!consent;

          return (
            <AppCard
              key={app.clientId}
              app={app}
              isConnected={isConnected}
              consent={consent}
              appUrl={appUrl}
              busy={busy}
              handleRevoke={handleRevoke}
            />
          );
        })}
      </div>
    </div>
  );
}

interface AppCardProps {
  app: typeof APPS[number];
  isConnected: boolean;
  consent: AuthorizedApp | undefined;
  appUrl: string;
  busy: string | null;
  handleRevoke: (clientId: string, clientName: string) => void;
}

function AppCard({ app, isConnected, consent, appUrl, busy, handleRevoke }: AppCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const IconComponent = app.icon;

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group flex flex-col justify-between border border-border/50 bg-card/70 backdrop-blur-md p-5 shadow-sm rounded-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
    >
      <div>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Dynamic liquid warping border radius on hover */}
            <motion.div
              animate={
                isHovered
                  ? {
                      borderRadius: ['8px', '14px 6px 14px 6px', '6px 14px 6px 14px', '8px'],
                      scale: 1.05,
                      rotate: [0, 4, -4, 0],
                    }
                  : { borderRadius: '8px', scale: 1, rotate: 0 }
              }
              transition={{ duration: 1.5, repeat: isHovered ? Infinity : 0, ease: 'easeInOut' }}
              className={cn(
                'flex size-11 items-center justify-center border border-border/20 text-white shadow-sm transition-colors',
                app.color
              )}
            >
              <IconComponent className="size-5.5" />
            </motion.div>
            <div>
              <h4 className="font-heading font-bold text-foreground text-sm md:text-base">{app.clientName}</h4>
              <span className="eyebrow text-[9px] text-muted-foreground bg-secondary/80 border border-border/30 px-2 py-0.5 mt-1 inline-block rounded-md">
                {app.category}
              </span>
            </div>
          </div>
          
          {/* Connection Status Badge */}
          {isConnected ? (
            <span className="flex items-center gap-1.5 font-mono text-[9px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
              <span className="inline-block size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              CONNECTED
            </span>
          ) : (
            <span className="font-mono text-[9px] text-muted-foreground border border-border/30 bg-muted/50 px-2.5 py-0.5 rounded-full">
              NOT LINKED
            </span>
          )}
        </div>
        
        <p className="mt-3.5 text-xs text-muted-foreground leading-relaxed">
          {app.userDescription}
        </p>

        {consent && (
          <div className="mt-3 flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
            <Key className="size-3 text-brand" />
            <span>Permissions: <strong>{consent.scope}</strong></span>
          </div>
        )}
      </div>

      <div className="mt-5 border-t border-border/40 pt-3.5 flex items-center justify-between gap-4">
        <span className="font-mono text-[9.5px] text-slate-400 truncate max-w-[180px]">
          {appUrl === '#' ? 'No URL' : appUrl}
        </span>

        <div className="flex gap-2">
          {isConnected && (
            <Button
              variant="danger"
              size="sm"
              className="h-8 shadow-xs"
              disabled={busy === app.clientId}
              onClick={() => handleRevoke(app.clientId, app.clientName)}
            >
              {busy === app.clientId ? 'Revoking…' : 'Disconnect'}
            </Button>
          )}
          <a href={appUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" className="h-8 gap-1 shadow-xs">
              Launch <ExternalLink className="size-3" />
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}
