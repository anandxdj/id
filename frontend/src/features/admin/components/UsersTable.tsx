'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as adminApi from '@/features/admin/services/adminApi';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { timeAgo } from '@/lib/utils';
import type { AdminUser } from '@/types';
import { Shield, ShieldCheck, User as UserIcon } from 'lucide-react';

export function UsersTable() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      adminApi
        .listUsers({ search: search || undefined, limit: 50 })
        .then((r) => setUsers(r.items))
        .catch((e) => setError(e.message));
    }, 200);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <div className="space-y-4">
      <Input placeholder="Search by name or email…" value={search} onChange={(e) => setSearch(e.target.value)} />
      {error && <p className="font-mono text-sm text-danger">{error}</p>}
      <div className="border-2 border-border bg-card shadow-brutal-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b-2 border-border bg-muted/60">
            <tr>
              <th className="px-4 py-2.5 text-left eyebrow text-muted-foreground">Name</th>
              <th className="px-4 py-2.5 text-left eyebrow text-muted-foreground">Email</th>
              <th className="px-4 py-2.5 text-left eyebrow text-muted-foreground">Role</th>
              <th className="px-4 py-2.5 text-left eyebrow text-muted-foreground">Status</th>
              <th className="px-4 py-2.5 text-left eyebrow text-muted-foreground">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => {
              const roleTone = u.role === 'superadmin' ? 'ok' : u.role === 'admin' ? 'warn' : 'default';
              return (
                <tr
                  key={u.id}
                  onClick={() => router.push(`/admin/users/${u.id}`)}
                  className="cursor-pointer hover:bg-muted/40 transition-colors"
                >
                  <td className="px-4 py-3 text-sm font-medium text-foreground">{u.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3 text-sm">
                    <Badge tone={roleTone} className="capitalize flex w-fit items-center gap-1">
                      {u.role === 'superadmin' && <ShieldCheck className="size-3 text-ok" />}
                      {u.role === 'admin' && <Shield className="size-3 text-warn" />}
                      {u.role === 'user' && <UserIcon className="size-3 text-muted-foreground" />}
                      {u.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {u.disabled ? (
                      <Badge tone="danger">Disabled</Badge>
                    ) : (
                      <Badge tone="ok">Active</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{timeAgo(u.createdAt)}</td>
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
