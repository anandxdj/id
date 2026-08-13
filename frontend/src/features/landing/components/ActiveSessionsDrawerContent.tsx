'use client';

import { useEffect, useState, useCallback } from 'react';
import { Laptop, Smartphone, ShieldCheck, LogOut, AlertCircle, RefreshCw } from 'lucide-react';
import * as accountApi from '@/features/account/services/accountApi';
import { Button } from '@/components/ui/button';
import { timeAgo } from '@/lib/utils';
import type { SessionView } from '@/types';

// Helper to parse user agent strings into simple readable device/browser names
function parseUserAgent(uaString: string | undefined): { browser: string; os: string; isMobile: boolean } {
  if (!uaString) return { browser: 'Unknown Browser', os: 'Unknown Device', isMobile: false };
  const ua = uaString.toLowerCase();
  
  let os = 'Unknown OS';
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('macintosh') || ua.includes('mac os x')) os = 'macOS';
  else if (ua.includes('linux')) os = 'Linux';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';

  let browser = 'Unknown Browser';
  if (ua.includes('chrome')) browser = 'Chrome';
  else if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
  else if (ua.includes('edge')) browser = 'Edge';

  const isMobile = ua.includes('mobi') || ua.includes('android') || ua.includes('iphone');
  return { browser, os, isMobile };
}

interface ActiveSessionsDrawerContentProps {
  onSessionsCountChanged?: (count: number) => void;
}

export function ActiveSessionsDrawerContent({ onSessionsCountChanged }: ActiveSessionsDrawerContentProps) {
  const [sessions, setSessions] = useState<SessionView[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadSessions = useCallback(() => {
    accountApi.listSessions()
      .then((data) => {
        setSessions(data);
        onSessionsCountChanged?.(data.length);
      })
      .catch((e) => setError(e.message));
  }, [onSessionsCountChanged]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  async function handleRevoke(sid: string) {
    if (!confirm('Sign out of this device? The application session will be terminated.')) return;
    setBusy(true);
    try {
      await accountApi.revokeSession(sid);
      const remaining = sessions?.filter((s) => s.sid !== sid) ?? null;
      setSessions(remaining);
      if (remaining) {
        onSessionsCountChanged?.(remaining.length);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRevokeAll() {
    if (!confirm('Sign out of all other devices and browser sessions?')) return;
    setBusy(true);
    try {
      await accountApi.revokeAllSessions();
      loadSessions();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div className="border-2 border-border bg-danger-foreground text-danger p-4 flex items-center gap-3">
        <AlertCircle className="size-5" />
        <p className="font-mono text-sm">Failed to retrieve sessions: {error}</p>
      </div>
    );
  }

  if (!sessions) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="eyebrow text-muted-foreground animate-pulse">LOADING ACTIVE SESSIONS…</p>
      </div>
    );
  }

  const otherSessionsCount = sessions.filter((s) => !s.current).length;

  return (
    <div className="space-y-6">
      {/* Drawer Control Actions */}
      <div className="flex items-center justify-between border-b border-border/40 pb-4">
        <span className="eyebrow text-[10px] text-muted-foreground">
          {sessions.length} ACTIVE {sessions.length === 1 ? 'SESSION' : 'SESSIONS'}
        </span>
        
        {otherSessionsCount > 0 && (
          <Button
            variant="secondary"
            size="sm"
            className="shadow-brutal-xs text-xs font-bold"
            disabled={busy}
            onClick={handleRevokeAll}
          >
            Sign Out Other Devices
          </Button>
        )}
      </div>

      {/* Session Cards list */}
      <div className="space-y-3">
        {sessions.map((s) => {
          const { browser, os, isMobile } = parseUserAgent(s.ua);
          const DeviceIcon = isMobile ? Smartphone : Laptop;

          return (
            <div
              key={s.sid}
              className={`flex items-center justify-between gap-4 border-2 border-border bg-card p-4 shadow-brutal-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-brutal ${
                s.current ? 'border-brand shadow-[3px_3px_0_0_var(--color-brand)] bg-brand/5' : ''
              }`}
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <span className={`flex size-10 items-center justify-center border-2 border-border bg-background shadow-brutal-xs ${
                  s.current ? 'border-brand' : ''
                }`}>
                  <DeviceIcon className={`size-5 ${s.current ? 'text-brand' : 'text-foreground'}`} />
                </span>
                
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <p className="font-heading font-bold text-foreground text-sm truncate">
                      {browser} on {os}
                    </p>
                    
                    {s.current && (
                      <span className="eyebrow text-[8px] bg-brand text-brand-foreground px-1.5 py-0.2 select-none font-black rounded-sm border border-border">
                        THIS DEVICE
                      </span>
                    )}
                  </div>
                  
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground truncate">
                    IP: {s.ip || 'Local Loopback'} · {s.current ? 'Active now' : `seen ${timeAgo(s.lastSeenAt)}`}
                  </p>
                </div>
              </div>

              {!s.current && (
                <Button
                  variant="danger"
                  size="sm"
                  className="h-8 shrink-0 shadow-brutal-xs"
                  disabled={busy}
                  onClick={() => handleRevoke(s.sid)}
                >
                  Sign Out
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
