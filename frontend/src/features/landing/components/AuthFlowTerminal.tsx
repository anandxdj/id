'use client';

import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Terminal } from 'lucide-react';

type Src = 'AUTHORIZE' | 'CONSENT' | 'TOKEN' | 'USERINFO' | 'OK';
interface Line {
  t: string;
  src: Src;
  text: string;
}

const LOG: Line[] = [
  { t: '00:00.04', src: 'AUTHORIZE', text: 'GET /oauth/authorize?client_id=acme&scope=openid+profile&code_challenge=…' },
  { t: '00:00.05', src: 'AUTHORIZE', text: 'Validating client + redirect_uri against registry… OK' },
  { t: '00:00.07', src: 'AUTHORIZE', text: 'No first-party session → redirect /login?return_to=…' },
  { t: '00:01.10', src: 'OK', text: 'User authenticated. Session whitelisted in Redis.' },
  { t: '00:01.21', src: 'CONSENT', text: 'Prompt: acme requests [ openid · profile ]' },
  { t: '00:02.40', src: 'CONSENT', text: 'Consent granted. Authorization code issued (single-use, 60s TTL).' },
  { t: '00:02.55', src: 'TOKEN', text: 'POST /oauth/token  grant_type=authorization_code + PKCE S256' },
  { t: '00:02.58', src: 'TOKEN', text: 'Code verified. Signing id_token (RS256, kid=2026-06)…' },
  { t: '00:02.60', src: 'OK', text: 'access_token + id_token returned. Event: token.issued recorded.' },
  { t: '00:03.05', src: 'USERINFO', text: 'GET /userinfo  Authorization: Bearer ****' },
  { t: '00:03.07', src: 'USERINFO', text: 'Claims: { sub, name, email } scoped to grant.' },
  { t: '00:03.09', src: 'OK', text: 'Handshake complete. Elapsed 3.09s.' },
];

const SRC_CLASS: Record<Src, string> = {
  AUTHORIZE: 'bg-muted text-foreground',
  CONSENT: 'bg-warn text-warn-foreground',
  TOKEN: 'bg-brand text-brand-foreground',
  USERINFO: 'bg-secondary text-secondary-foreground',
  OK: 'bg-ok text-ok-foreground',
};

export function AuthFlowTerminal() {
  const [lines, setLines] = useState<Line[]>([]);
  const [i, setI] = useState(0);
  const [running, setRunning] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!running) return;
    if (i === 0) setLines([]);
    const id = setTimeout(
      () => {
        setLines((p) => [...p, LOG[i]]);
        if (i < LOG.length - 1) setI((n) => n + 1);
        else setRunning(false);
      },
      i === 0 ? 350 : 480,
    );
    return () => clearTimeout(id);
  }, [i, running]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  return (
    <div className="flex h-[420px] flex-col border-2 border-border bg-card font-mono shadow-brutal-xl">
      {/* titlebar */}
      <div className="flex items-center justify-between border-b-2 border-border bg-muted px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="flex gap-1">
            <span className="size-2.5 border border-border bg-danger" />
            <span className="size-2.5 border border-border bg-warn" />
            <span className="size-2.5 border border-border bg-ok" />
          </span>
          <span className="eyebrow text-muted-foreground">[ OIDC_HANDSHAKE.log ]</span>
        </div>
        <span className="eyebrow hidden text-muted-foreground sm:inline">RS256 · PKCE · S256</span>
      </div>

      {/* stream */}
      <div className="flex-1 space-y-2 overflow-y-auto p-4 text-[11px] leading-relaxed">
        {lines.length === 0 ? (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Terminal className="size-3.5" /> awaiting authorize request…
          </div>
        ) : (
          lines.map((l, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <span className="shrink-0 select-none text-muted-foreground">[{l.t}]</span>
              <span className={`shrink-0 select-none border border-border px-1 text-[9px] font-bold uppercase ${SRC_CLASS[l.src]}`}>
                {l.src}
              </span>
              <span className="flex-1 break-all text-foreground">{l.text}</span>
            </div>
          ))
        )}
        {running && <span className="inline-block size-2 animate-pulse bg-brand align-middle" />}
        <div ref={endRef} />
      </div>

      {/* controls */}
      <div className="flex items-center justify-between border-t-2 border-border px-3 py-2">
        <button
          onClick={() => {
            setI(0);
            setRunning(true);
          }}
          disabled={running}
          className="inline-flex items-center gap-1.5 border-2 border-border bg-brand px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-brand-foreground shadow-brutal-xs transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 disabled:opacity-40 disabled:hover:translate-x-0 disabled:hover:translate-y-0"
        >
          <RefreshCw className={`size-3 ${running ? 'animate-spin' : ''}`} /> Replay flow
        </button>
        <span className="eyebrow text-muted-foreground">
          {lines.length}/{LOG.length}
        </span>
      </div>
    </div>
  );
}
