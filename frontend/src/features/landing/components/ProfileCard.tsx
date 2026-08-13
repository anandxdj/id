'use client';

import { ShieldCheck, User, Mail, ShieldAlert } from 'lucide-react';
import type { User as UserType } from '@/types';

interface ProfileCardProps {
  user: UserType;
}

export function ProfileCard({ user }: ProfileCardProps) {
  const firstLetter = user.name ? user.name.charAt(0).toUpperCase() : '?';

  return (
    <div className="flex flex-col justify-between border-2 border-border bg-card/90 backdrop-blur-md p-6 shadow-brutal transition-all duration-300 hover:-translate-x-0.5 hover:-translate-y-1 hover:shadow-brutal-lg">
      <div className="space-y-4">
        {/* Card Header Eyebrow */}
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <span className="eyebrow text-[10px] text-muted-foreground">[ PROFILE_ACCOUNT ]</span>
          <span className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
            ID: <span className="text-foreground font-bold">{user._id.slice(-6)}</span>
          </span>
        </div>

        {/* Profile Details Block */}
        <div className="flex items-center gap-4">
          {/* Neobrutalist Avatar */}
          <div className="flex size-14 shrink-0 items-center justify-center border-2 border-border bg-brand text-2xl font-heading font-black text-brand-foreground shadow-brutal-xs">
            {firstLetter}
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-heading text-lg font-bold text-foreground">{user.name}</h3>
            <p className="flex items-center gap-1 truncate font-mono text-xs text-muted-foreground mt-0.5">
              <Mail className="size-3 text-brand" /> {user.email}
            </p>
          </div>
        </div>

        {/* Account Details Rows */}
        <div className="mt-4 space-y-2 border-t border-border/40 pt-4">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-brand" /> Status
            </span>
            <span className="font-heading font-bold text-foreground">
              {user.isVerified ? '✓ Email Verified' : '○ Not Verified'}
            </span>
          </div>

          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <User className="size-3.5 text-brand" /> System Role
            </span>
            <span className="font-heading font-bold text-brand bg-black dark:bg-transparent dark:text-brand px-1.5 py-0.5 text-[10px] uppercase font-black tracking-wide rounded-sm">
              {user.role}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6 text-[10px] font-mono text-muted-foreground border-t border-border/40 pt-4">
        Managed by Anand&apos;s OIDC Provider
      </div>
    </div>
  );
}
