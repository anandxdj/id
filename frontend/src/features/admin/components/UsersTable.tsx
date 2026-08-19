'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import * as adminApi from '@/features/admin/services/adminApi';
import { ADMIN_PAGE_SIZE } from '@/features/admin/services/adminApi';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import { timeAgo } from '@/lib/utils';
import type { AdminUser } from '@/types';
import { Shield, ShieldCheck, User as UserIcon } from 'lucide-react';

export function UsersTable() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const querySearch = searchParams.get('search') ?? '';
  const rawPage = Number(searchParams.get('page'));
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState(querySearch);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setSearch(querySearch), 0);
    return () => clearTimeout(timer);
  }, [querySearch]);

  useEffect(() => {
    const t = setTimeout(() => {
      const value = search.trim();
      if (value === querySearch) return;
      const query = new URLSearchParams(searchParams.toString());
      if (value) query.set('search', value);
      else query.delete('search');
      query.delete('page');
      router.replace(`/admin/users?${query.toString()}`);
    }, 200);
    return () => clearTimeout(t);
  }, [querySearch, router, search, searchParams]);

  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => {
        if (!active) return null;
        setLoading(true);
        setError('');
        return adminApi.listUsers({ search: querySearch || undefined, page, limit: ADMIN_PAGE_SIZE });
      })
      .then((result) => {
        if (!active || !result) return;
        if (result.items.length === 0 && result.total > 0 && page > 1) {
          const query = new URLSearchParams(searchParams.toString());
          const previous = page - 1;
          if (previous > 1) query.set('page', String(previous));
          else query.delete('page');
          router.replace(`/admin/users?${query.toString()}`);
          return;
        }
        setUsers(result.items);
        setTotal(result.total);
      })
      .catch(() => {
        if (active) setError('Users could not be loaded.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, querySearch, router, searchParams]);

  const setPage = (value: number) => {
    const query = new URLSearchParams(searchParams.toString());
    if (value > 1) query.set('page', String(value));
    else query.delete('page');
    router.push(`/admin/users?${query.toString()}`);
  };

  return (
    <div className="space-y-4">
      <Input placeholder="Search by name or email…" value={search} onChange={(e) => setSearch(e.target.value)} />
      {error && <p className="font-mono text-sm text-danger">{error}</p>}
      <div className="overflow-x-auto rounded-xl border border-border/60 bg-card shadow-brutal-sm">
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
            {!loading && users.map((u) => {
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
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center eyebrow text-muted-foreground">LOADING...</td>
              </tr>
            )}
            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!loading && !error && (
        <Pagination
          page={page}
          pageSize={ADMIN_PAGE_SIZE}
          count={users.length}
          total={total}
          hasPrevious={page > 1}
          hasNext={page * ADMIN_PAGE_SIZE < total}
          onPrevious={() => setPage(page - 1)}
          onNext={() => setPage(page + 1)}
          noun="users"
        />
      )}
    </div>
  );
}
