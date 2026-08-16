'use client';

import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Terminal, CheckCircle2 } from 'lucide-react';

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

const SRC_COLORS: Record<Src, string> = {
  AUTHORIZE: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10',
  CONSENT: 'text-amber-400 border-amber-500/20 bg-amber-500/10',
  TOKEN: 'text-indigo-400 border-indigo-500/20 bg-indigo-500/10',
  USERINFO: 'text-sky-400 border-sky-500/20 bg-sky-500/10',
  OK: 'text-brand border-brand/20 bg-brand/10',
};

export function AuthFlowTerminal() {
  const [lines, setLines] = useState<Line[]>([LOG[0]]);
  const [i, setI] = useState(0);
  const [running, setRunning] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!running || i >= LOG.length - 1) return;
    const id = setTimeout(
      () => {
        const nextIndex = i + 1;
        setLines((p) => [...p, LOG[nextIndex]]);
        setI(nextIndex);
        if (nextIndex === LOG.length - 1) {
          setRunning(false);
        }
      },
      i === 0 ? 350 : 500,
    );
    return () => clearTimeout(id);
  }, [i, running]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  const replayFlow = () => {
    setLines([LOG[0]]);
    setI(0);
    setRunning(true);
  };

  return (
    <div id="flow" className="flex h-[420px] flex-col border border-border bg-card dark:bg-[#0B0F19] font-mono shadow-md rounded-xl overflow-hidden transition-colors duration-300">
      {/* Title bar */}
      <div className="flex items-center justify-between border-b border-border bg-muted/70 dark:bg-[#161D30] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex gap-1.5 select-none">
            <span className="size-2.5 rounded-full bg-rose-500" />
            <span className="size-2.5 rounded-full bg-amber-500" />
            <span className="size-2.5 rounded-full bg-emerald-500" />
          </span>
          <span className="eyebrow text-muted-foreground dark:text-slate-400 font-bold text-[10px] select-none">[ OIDC_HANDSHAKE.log ]</span>
        </div>
        <span className="eyebrow hidden text-muted-foreground dark:text-slate-400 sm:inline text-[9px] select-none">
          RS256 · PKCE · S256
        </span>
      </div>

      {/* Log streams */}
      <div className="flex-1 space-y-2.5 overflow-y-auto p-4 text-[11px] leading-relaxed scrollbar-thin scrollbar-thumb-zinc-400 dark:scrollbar-thumb-slate-700">
        {lines.length === 0 ? (
          <div className="flex items-center gap-2 text-muted-foreground dark:text-slate-500">
            <Terminal className="size-3.5 animate-pulse text-brand" /> awaiting OIDC request…
          </div>
        ) : (
          lines.map((l, idx) => (
            <div key={idx} className="flex items-start gap-2.5 animate-in fade-in slide-in-from-bottom-1 duration-200">
              <span className="shrink-0 select-none text-muted-foreground dark:text-slate-500">[{l.t}]</span>
              <span className={`shrink-0 select-none border px-2 py-0.5 text-[8.5px] font-semibold uppercase tracking-wider rounded-md ${SRC_COLORS[l.src]}`}>
                {l.src}
              </span>
              <span className="flex-1 break-all text-foreground dark:text-slate-200">{l.text}</span>
            </div>
          ))
        )}
        {running && (
          <div className="flex items-center gap-2 text-muted-foreground dark:text-slate-500 pl-16">
            <span className="inline-block size-2 animate-pulse bg-brand" />
            <span className="text-[10px] italic">Processing token claims…</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Terminal Footer Controls */}
      <div className="flex items-center justify-between border-t border-border bg-muted/70 dark:bg-[#161D30] px-4 py-2.5">
        <button
          onClick={replayFlow}
          disabled={running}
          className="inline-flex items-center gap-2 border border-transparent bg-foreground text-background px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide shadow-sm rounded-lg transition-all hover:opacity-95 active:scale-95 disabled:opacity-40 disabled:active:scale-100 cursor-pointer"
        >
          <RefreshCw className={`size-3.5 ${running ? 'animate-spin' : ''}`} />
          Replay Handshake
        </button>
        <span className="eyebrow text-muted-foreground dark:text-slate-400 text-[10px] select-none flex items-center gap-1.5">
          {lines.length === LOG.length && <CheckCircle2 className="size-3.5 text-brand" />}
          <span>
            {lines.length}/{LOG.length} LOGS
          </span>
        </span>
      </div>
    </div>
  );
}
