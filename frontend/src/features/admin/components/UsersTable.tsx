'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as adminApi from '@/features/admin/services/adminApi';
import { Input } from '@/components/ui/input';
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
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.03] text-xs text-white/50">
            <tr>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Email</th>
              <th className="px-4 py-2.5 font-medium">Role</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {users.map((u) => (
              <tr
                key={u.id}
                onClick={() => router.push(`/admin/users/${u.id}`)}
                className="cursor-pointer hover:bg-white/[0.03]"
              >
                <td className="px-4 py-2.5 text-white">{u.name}</td>
                <td className="px-4 py-2.5 text-white/70">{u.email}</td>
                <td className="px-4 py-2.5 text-white/60">{u.role}</td>
                <td className="px-4 py-2.5">
                  {u.disabled ? (
                    <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-300">Disabled</span>
                  ) : (
                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-300">Active</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-white/40">{timeAgo(u.createdAt)}</td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-white/40">
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
