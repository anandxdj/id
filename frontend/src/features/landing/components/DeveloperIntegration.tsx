"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Terminal, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SNIPPETS = {
  nextauth: `// app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";

export const authOptions = {
  providers: [
    {
      id: "anand-id",
      name: "Anand ID",
      type: "oauth",
      authorization: "https://id.anand.dev/oauth/authorize",
      token: "https://id.anand.dev/api/oauth/token",
      userinfo: "https://id.anand.dev/api/oauth/userinfo",
      clientId: process.env.ANAND_ID_CLIENT_ID,
      clientSecret: process.env.ANAND_ID_CLIENT_SECRET,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture
        };
      },
    }
  ]
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };`,

  express: `// server.js
const express = require('express');
const { auth } = require('express-openid-connect');

const app = express();

app.use(
  auth({
    issuerBaseURL: 'https://id.anand.dev',
    baseURL: 'https://app.anand.dev',
    clientID: 'cl_example_app',
    secret: process.env.SESSION_SECRET,
    idpLogout: true,
  })
);

app.get('/', (req, res) => {
  res.send(req.oidc.isAuthenticated() ? 'Logged in' : 'Logged out');
});`,

  discovery: `{
  "issuer": "https://id.anand.dev",
  "authorization_endpoint": "https://id.anand.dev/oauth/authorize",
  "token_endpoint": "https://id.anand.dev/api/oauth/token",
  "userinfo_endpoint": "https://id.anand.dev/api/oauth/userinfo",
  "jwks_uri": "https://id.anand.dev/api/oauth/jwks",
  "response_types_supported": ["code"],
  "subject_types_supported": ["public"],
  "id_token_signing_alg_values_supported": ["RS256"]
}`
};

export function DeveloperIntegration() {
  const [activeTab, setActiveTab] = useState<keyof typeof SNIPPETS>('nextauth');
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(SNIPPETS[activeTab]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="dev-integration" className="relative z-10 mx-auto max-w-6xl px-6 py-16 border-t border-border/40">
      <div className="border-b border-border/40 pb-6 mb-8">
        <span className="eyebrow text-muted-foreground">[ 04_DEVELOPER_INTEGRATION ]</span>
        <h2 className="font-heading text-3xl font-bold tracking-tight mt-1 text-foreground">
          CONNECTING NEW APPLICATIONS
        </h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-lg">
          Add any client or application to Anand&apos;s OIDC server. Configure these parameters to instantly enable single sign-on.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Navigation Tabs */}
        <div className="flex flex-row lg:flex-col gap-2 shrink-0 lg:w-48 overflow-x-auto">
          {[
            { id: 'nextauth', label: 'NextAuth.js' },
            { id: 'express', label: 'Express OIDC' },
            { id: 'discovery', label: 'Well-Known OIDC' }
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as keyof typeof SNIPPETS)}
                className={cn(
                  'relative eyebrow border px-4 py-2.5 text-xs text-left font-semibold cursor-pointer rounded-lg overflow-hidden transition-all duration-300',
                  isActive
                    ? 'text-brand-foreground border-transparent shadow-sm'
                    : 'bg-card/50 text-muted-foreground border-border/50 hover:text-foreground hover:bg-accent/40'
                )}
              >
                {isActive && (
                  <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden" style={{ filter: 'url(#gooey-global)' }}>
                    <motion.div
                      layoutId="activeIntegrationBg"
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
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Code Block Display */}
        <div className="flex-1 border border-border/50 bg-[#0B0F19] shadow-md rounded-xl overflow-hidden relative">
          <div className="flex items-center justify-between border-b border-border/40 bg-[#161D30] px-4 py-2">
            <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
              <Terminal className="size-4 text-brand" />
              <span>{activeTab === 'discovery' ? 'openid-configuration.json' : 'integration.ts'}</span>
            </div>
            
            <Button
              size="sm"
              variant="secondary"
              className="h-7 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-600 gap-1 rounded-md"
              onClick={copyToClipboard}
            >
              {copied ? (
                <>
                  <Check className="size-3 text-emerald-400" /> Copied!
                </>
              ) : (
                <>
                  <Copy className="size-3" /> Copy
                </>
              )}
            </Button>
          </div>

          <pre className="p-4 overflow-x-auto font-mono text-xs text-slate-300 leading-relaxed max-h-[380px] bg-[#0B0F19]">
            <code>{SNIPPETS[activeTab]}</code>
          </pre>
        </div>
      </div>
    </section>
  );
}
