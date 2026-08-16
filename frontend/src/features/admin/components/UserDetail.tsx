'use client';

import { useEffect, useState } from 'react';
import * as adminApi from '@/features/admin/services/adminApi';
import { useAuth } from '@/features/auth/context/AuthContext';
import { ActivityFeed } from '@/features/admin/components/ActivityFeed';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Panel } from '@/components/ui/panel';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { timeAgo } from '@/lib/utils';
import type { AdminUserDetail } from '@/types';
import { Shield, ShieldAlert, ShieldCheck, UserCheck, AlertTriangle } from 'lucide-react';

export function UserDetail({ userId }: { userId: string }) {
  const { user: currentUser } = useAuth();
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  // Modals state
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'user' | 'admin' | 'superadmin'>('user');
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  const [isSuspendModalOpen, setIsSuspendModalOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [suspendConfirmText, setSuspendConfirmText] = useState('');
  const [isSuspending, setIsSuspending] = useState(false);

  const [isUnsuspendModalOpen, setIsUnsuspendModalOpen] = useState(false);
  const [isUnsuspending, setIsUnsuspending] = useState(false);

  const load = () =>
    adminApi
      .getUser(userId)
      .then((d) => {
        setDetail(d);
        setSelectedRole(d.user.role as 'user' | 'admin' | 'superadmin');
      })
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function handleRoleChange() {
    if (!detail) return;
    setIsUpdatingRole(true);
    setActionError('');
    try {
      await adminApi.changeUserRole(userId, selectedRole);
      setIsRoleModalOpen(false);
      await load();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setIsUpdatingRole(false);
    }
  }

  async function handleSuspendUser() {
    if (!detail || suspendConfirmText !== 'DELETE') return;
    setIsSuspending(true);
    setActionError('');
    try {
      await adminApi.suspendUser(userId, suspendReason.trim() || 'Disabled by admin');
      setIsSuspendModalOpen(false);
      setSuspendReason('');
      setSuspendConfirmText('');
      await load();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setIsSuspending(false);
    }
  }

  async function handleUnsuspendUser() {
    if (!detail) return;
    setIsUnsuspending(true);
    setActionError('');
    try {
      await adminApi.unsuspendUser(userId);
      setIsUnsuspendModalOpen(false);
      await load();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setIsUnsuspending(false);
    }
  }

  if (error) return <p className="font-mono text-sm text-danger">{error}</p>;
  if (!detail) return <p className="eyebrow text-muted-foreground">LOADING…</p>;

  const { user, sessions, apps, activity } = detail;
  const isSuperadmin = currentUser?.role === 'superadmin';
  const isSelf = currentUser?._id === user.id;

  const roleTone = user.role === 'superadmin' ? 'ok' : user.role === 'admin' ? 'warn' : 'default';

  return (
    <div className="space-y-8">
      {actionError && (
        <div className="flex items-center gap-2 rounded-lg border border-danger/40 bg-danger/10 p-4 text-xs font-mono text-danger">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* User Header Profile */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-2 border-border bg-card p-6 shadow-brutal-sm">
        <div className="flex items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-lg border-2 border-border bg-muted font-mono font-bold text-lg text-foreground">
            {user.name.slice(0, 2).toUpperCase()}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-2xl font-bold text-foreground">{user.name}</h1>
              {user.disabled ? <Badge tone="danger">Disabled</Badge> : <Badge tone="ok">Active</Badge>}
              <Badge tone={roleTone} className="capitalize flex items-center gap-1">
                {user.role === 'superadmin' && <ShieldCheck className="size-3 text-ok" />}
                {user.role === 'admin' && <Shield className="size-3 text-warn" />}
                {user.role}
              </Badge>
            </div>

            <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>

            <div className="mt-3 flex flex-wrap items-center gap-3 font-mono text-xs text-muted-foreground">
              <span>User ID: <code className="text-foreground">{user.id}</code></span>
              <span>·</span>
              <span>Joined {timeAgo(user.createdAt)}</span>
              {user.disabled && user.disabledAt && (
                <>
                  <span>·</span>
                  <span className="text-danger font-medium">Disabled {timeAgo(user.disabledAt)}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap shrink-0 items-center gap-2">
          {isSuperadmin && !isSelf && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSelectedRole(user.role as 'user' | 'admin' | 'superadmin');
                setActionError('');
                setIsRoleModalOpen(true);
              }}
              className="flex items-center gap-1.5"
            >
              <ShieldCheck className="size-3.5" />
              Promote / Change Role
            </Button>
          )}

          {!isSelf && (
            <Button
              variant={user.disabled ? 'secondary' : 'danger'}
              size="sm"
              onClick={() => {
                setActionError('');
                if (user.disabled) setIsUnsuspendModalOpen(true);
                else {
                  setSuspendReason('');
                  setSuspendConfirmText('');
                  setIsSuspendModalOpen(true);
                }
              }}
            >
              {user.disabled ? 'Reinstate' : 'Disable user'}
            </Button>
          )}
        </div>
      </div>

      <Panel label={`[ SESSIONS ] (${sessions.length})`}>
        {sessions.length === 0 ? (
          <div className="border-2 border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">No active sessions.</p>
          </div>
        ) : (
          <ul className="space-y-2 text-sm">
            {sessions.map((s) => (
              <li
                key={s.sid}
                className="border-2 border-border bg-card px-3 py-2 font-mono text-xs text-muted-foreground shadow-brutal-sm"
              >
                {s.ua || 'Unknown device'} · {s.ip || 'no ip'} · active {timeAgo(s.lastSeenAt)}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel label={`[ AUTHORIZED_APPS ] (${apps.length})`}>
        {apps.length === 0 ? (
          <div className="border-2 border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">No authorized apps.</p>
          </div>
        ) : (
          <ul className="space-y-2 text-sm">
            {apps.map((a) => (
              <li
                key={a.clientId}
                className="border-2 border-border bg-card px-3 py-2 font-mono text-xs text-muted-foreground shadow-brutal-sm"
              >
                {a.clientName} · {a.scope} · last used {timeAgo(a.lastUsedAt)}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel label="[ RECENT_ACTIVITY ]">
        <ActivityFeed events={activity} />
      </Panel>

      {/* ── Modal: Promote / Change User Role (Superadmin Only) ── */}
      <Modal
        open={isRoleModalOpen}
        onClose={() => !isUpdatingRole && setIsRoleModalOpen(false)}
        title="Promote or Change User Role"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Modify the administrative authority level for <strong>{user.name}</strong> (<code className="font-mono text-xs">{user.email}</code>).
          </p>

          <div className="space-y-2.5">
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-lg border-2 p-3 transition-colors ${
                selectedRole === 'user'
                  ? 'border-foreground bg-accent/40'
                  : 'border-border hover:border-foreground/40'
              }`}
              onClick={() => setSelectedRole('user')}
            >
              <input
                type="radio"
                name="role"
                value="user"
                checked={selectedRole === 'user'}
                onChange={() => setSelectedRole('user')}
                className="mt-0.5"
              />
              <div>
                <p className="font-bold text-sm text-foreground flex items-center gap-1.5">
                  <UserCheck className="size-4 text-muted-foreground" />
                  Regular User (`user`)
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Standard end-user access. Can log in and authorize OAuth applications.
                </p>
              </div>
            </label>

            <label
              className={`flex cursor-pointer items-start gap-3 rounded-lg border-2 p-3 transition-colors ${
                selectedRole === 'admin'
                  ? 'border-foreground bg-accent/40'
                  : 'border-border hover:border-foreground/40'
              }`}
              onClick={() => setSelectedRole('admin')}
            >
              <input
                type="radio"
                name="role"
                value="admin"
                checked={selectedRole === 'admin'}
                onChange={() => setSelectedRole('admin')}
                className="mt-0.5"
              />
              <div>
                <p className="font-bold text-sm text-foreground flex items-center gap-1.5">
                  <Shield className="size-4 text-warn" />
                  Administrator (`admin`)
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Full admin dashboard access. Can manage OAuth apps, rotate secrets, inspect users, and view audit metrics.
                </p>
              </div>
            </label>

            <label
              className={`flex cursor-pointer items-start gap-3 rounded-lg border-2 p-3 transition-colors ${
                selectedRole === 'superadmin'
                  ? 'border-foreground bg-accent/40'
                  : 'border-border hover:border-foreground/40'
              }`}
              onClick={() => setSelectedRole('superadmin')}
            >
              <input
                type="radio"
                name="role"
                value="superadmin"
                checked={selectedRole === 'superadmin'}
                onChange={() => setSelectedRole('superadmin')}
                className="mt-0.5"
              />
              <div>
                <p className="font-bold text-sm text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="size-4 text-ok" />
                  Superadmin (`superadmin`)
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Root platform governance. Can promote and demote other administrators, modify roles, and enforce security policies.
                </p>
              </div>
            </label>
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="ghost"
              disabled={isUpdatingRole}
              onClick={() => setIsRoleModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={isUpdatingRole || selectedRole === user.role}
              onClick={handleRoleChange}
            >
              {isUpdatingRole ? 'Updating Role…' : 'Save Role Change'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Modal: Disable / Suspend User ── */}
      <Modal
        open={isSuspendModalOpen}
        onClose={() => !isSuspending && setIsSuspendModalOpen(false)}
        title="Disable User Account"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-danger/40 bg-danger/10 p-3.5 text-xs text-danger-foreground">
            <ShieldAlert className="size-5 shrink-0 text-danger" />
            <p>
              Disabling <strong>{user.name}</strong> will revoke all active sessions immediately and prevent the user from signing in.
            </p>
          </div>

          <div>
            <label className="block text-xs font-mono font-bold uppercase text-muted-foreground mb-1.5">
              Reason for suspension (Optional)
            </label>
            <Input
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="e.g. Suspicious activity or policy violation"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-mono text-muted-foreground">
              To confirm disabling this user, type <strong className="font-bold underline text-foreground">DELETE</strong> below:
            </label>
            <Input
              value={suspendConfirmText}
              onChange={(e) => setSuspendConfirmText(e.target.value)}
              placeholder="Type 'DELETE' to confirm"
              className="font-mono"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="ghost"
              disabled={isSuspending}
              onClick={() => setIsSuspendModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={suspendConfirmText !== 'DELETE' || isSuspending}
              onClick={handleSuspendUser}
            >
              {isSuspending ? 'Disabling…' : 'Disable User Account'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Modal: Reinstate / Unsuspend User ── */}
      <Modal
        open={isUnsuspendModalOpen}
        onClose={() => !isUnsuspending && setIsUnsuspendModalOpen(false)}
        title="Reinstate User Account"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Reinstate <strong>{user.name}</strong> (<code className="font-mono text-xs">{user.email}</code>)? The user will be permitted to log in again.
          </p>

          <div className="flex justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="ghost"
              disabled={isUnsuspending}
              onClick={() => setIsUnsuspendModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={isUnsuspending}
              onClick={handleUnsuspendUser}
            >
              {isUnsuspending ? 'Reinstating…' : 'Reinstate User'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
