'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as adminApi from '@/features/admin/services/adminApi';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { timeAgo } from '@/lib/utils';
import type { AdminUser } from '@/types';

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
      <div className="border-2 border-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b-2 border-border bg-muted">
            <tr>
              <th className="px-4 py-2.5 text-left eyebrow text-muted-foreground">Name</th>
              <th className="px-4 py-2.5 text-left eyebrow text-muted-foreground">Email</th>
              <th className="px-4 py-2.5 text-left eyebrow text-muted-foreground">Role</th>
              <th className="px-4 py-2.5 text-left eyebrow text-muted-foreground">Status</th>
              <th className="px-4 py-2.5 text-left eyebrow text-muted-foreground">Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr
                key={u.id}
                onClick={() => router.push(`/admin/users/${u.id}`)}
                className="cursor-pointer border-b border-border hover:bg-muted"
              >
                <td className="px-4 py-3 text-sm text-foreground">{u.name}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{u.role}</td>
                <td className="px-4 py-3 text-sm">
                  {u.disabled ? (
                    <Badge tone="danger">Disabled</Badge>
                  ) : (
                    <Badge tone="ok">Active</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{timeAgo(u.createdAt)}</td>
              </tr>
            ))}
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
