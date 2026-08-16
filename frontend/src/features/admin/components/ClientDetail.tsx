'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import * as adminApi from '@/features/admin/services/adminApi';
import { ActivityFeed } from '@/features/admin/components/ActivityFeed';
import { ConfigPromptBlock } from '@/features/admin/components/ConfigPromptBlock';
import { SecretRevealOnce } from '@/features/admin/components/SecretRevealOnce';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Panel } from '@/components/ui/panel';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { timeAgo, cn } from '@/lib/utils';
import type { AdminClientDetail } from '@/types';
import {
  Copy,
  Check,
  Users,
  Activity,
  ShieldCheck,
  KeyRound,
  ExternalLink,
  Settings2,
  Code2,
  Plus,
  Trash2,
  Globe2,
  AlertTriangle,
  Flame,
} from 'lucide-react';

type TabId = 'integration' | 'users' | 'activity' | 'settings';

export function ClientDetail({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [detail, setDetail] = useState<AdminClientDetail | null>(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabId>('integration');
  const [rotatedSecret, setRotatedSecret] = useState<string | null>(null);
  const [copiedClientId, setCopiedClientId] = useState(false);

  // Modals state
  const [isSuspendModalOpen, setIsSuspendModalOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [suspendConfirmText, setSuspendConfirmText] = useState('');
  const [isSuspending, setIsSuspending] = useState(false);

  const [isUnsuspendModalOpen, setIsUnsuspendModalOpen] = useState(false);
  const [isUnsuspending, setIsUnsuspending] = useState(false);

  const [isRotateModalOpen, setIsRotateModalOpen] = useState(false);
  const [isRotating, setIsRotating] = useState(false);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit form state
  const [clientName, setClientName] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [redirectUris, setRedirectUris] = useState<string[]>(['']);
  const [postLogoutRedirectUris, setPostLogoutRedirectUris] = useState<string[]>([]);
  const [scopesText, setScopesText] = useState('');
  const [tokenEndpointAuthMethod, setTokenEndpointAuthMethod] = useState<
    'client_secret_basic' | 'client_secret_post' | 'none'
  >('client_secret_basic');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');

  const load = () =>
    adminApi
      .getClient(clientId)
      .then((d) => {
        setDetail(d);
        // Init edit form
        setClientName(d.client.clientName);
        setDescription(d.client.description || '');
        setLogoUrl(d.client.logoUrl || '');
        setRedirectUris(
          d.client.redirectUris && d.client.redirectUris.length > 0 ? d.client.redirectUris : [''],
        );
        setPostLogoutRedirectUris(d.client.postLogoutRedirectUris || []);
        setScopesText((d.client.scopes || []).join(' '));
        setTokenEndpointAuthMethod(
          (d.client.tokenEndpointAuthMethod as 'client_secret_basic' | 'client_secret_post' | 'none') ||
            'client_secret_basic',
        );
      })
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function copyClientId() {
    if (!detail) return;
    await navigator.clipboard.writeText(detail.client.clientId);
    setCopiedClientId(true);
    setTimeout(() => setCopiedClientId(false), 2000);
  }

  async function handleRotateSecret() {
    if (!detail) return;
    setIsRotating(true);
    try {
      const res = await adminApi.rotateSecret(clientId);
      setRotatedSecret(res.clientSecret);
      setIsRotateModalOpen(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsRotating(false);
    }
  }

  async function handleSuspendApp() {
    if (!detail || suspendConfirmText !== 'DELETE') return;
    setIsSuspending(true);
    try {
      await adminApi.setClientSuspended(
        clientId,
        true,
        suspendReason.trim() || 'Suspended by admin',
      );
      setIsSuspendModalOpen(false);
      setSuspendReason('');
      setSuspendConfirmText('');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsSuspending(false);
    }
  }

  async function handleUnsuspendApp() {
    if (!detail) return;
    setIsUnsuspending(true);
    try {
      await adminApi.setClientSuspended(clientId, false);
      setIsUnsuspendModalOpen(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsUnsuspending(false);
    }
  }

  async function handleDeleteApp() {
    if (!detail || deleteConfirmText !== 'DELETE') return;
    setIsDeleting(true);
    try {
      await adminApi.deleteClient(clientId);
      setIsDeleteModalOpen(false);
      router.push('/admin/apps');
    } catch (e) {
      setError((e as Error).message);
      setIsDeleting(false);
    }
  }

  // Dynamic URI list handlers
  function updateRedirectUri(index: number, val: string) {
    setRedirectUris((current) => current.map((uri, idx) => (idx === index ? val : uri)));
  }

  function addRedirectUri() {
    setRedirectUris((current) => [...current, '']);
  }

  function removeRedirectUri(index: number) {
    setRedirectUris((current) => current.filter((_, idx) => idx !== index));
  }

  function updatePostLogoutUri(index: number, val: string) {
    setPostLogoutRedirectUris((current) => current.map((uri, idx) => (idx === index ? val : uri)));
  }

  function addPostLogoutUri() {
    setPostLogoutRedirectUris((current) => [...current, '']);
  }

  function removePostLogoutUri(index: number) {
    setPostLogoutRedirectUris((current) => current.filter((_, idx) => idx !== index));
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!detail) return;

    const uris = redirectUris.map((u) => u.trim()).filter(Boolean);

    if (uris.length === 0) {
      setSaveError('Add at least one redirect URI.');
      return;
    }

    const postLogoutUris = postLogoutRedirectUris.map((u) => u.trim()).filter(Boolean);

    const scopes = scopesText
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    setSaveStatus('saving');
    setSaveError('');

    try {
      await adminApi.updateClient(clientId, {
        clientName: clientName.trim(),
        description: description.trim(),
        logoUrl: logoUrl.trim(),
        redirectUris: uris,
        postLogoutRedirectUris: postLogoutUris,
        scopes: scopes.length > 0 ? scopes : undefined,
        tokenEndpointAuthMethod,
      });
      setSaveStatus('saved');
      await load();
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (err) {
      setSaveStatus('error');
      setSaveError((err as Error).message || 'Failed to update app settings');
    }
  }

  if (error) return <p className="font-mono text-sm text-danger">{error}</p>;
  if (!detail) return <p className="eyebrow text-muted-foreground">LOADING APP DETAILS…</p>;

  const { client, metrics, authorizedUsers, activity, configPrompt } = detail;
  const isPublicClient = client.tokenEndpointAuthMethod === 'none';

  const tabs: Array<{ id: TabId; label: string; icon: typeof KeyRound; count?: number }> = [
    { id: 'integration', label: 'Credentials & Wiring', icon: Code2 },
    { id: 'users', label: 'Users', icon: Users, count: authorizedUsers.length },
    { id: 'activity', label: 'Activity', icon: Activity, count: activity.length },
    { id: 'settings', label: 'Settings', icon: Settings2 },
  ];

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-2 border-border bg-card p-6 shadow-brutal-sm">
        <div className="flex items-start gap-4">
          {client.logoUrl ? (
            <img
              src={client.logoUrl}
              alt={client.clientName}
              className="size-14 rounded-lg border border-border object-cover bg-background shrink-0"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="flex size-14 shrink-0 items-center justify-center rounded-lg border-2 border-border bg-muted font-mono font-bold text-foreground">
              {client.clientName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-2xl font-bold text-foreground">{client.clientName}</h1>
              {client.suspended ? <Badge tone="danger">Suspended</Badge> : <Badge tone="ok">Active</Badge>}
              <Badge tone="warn">{isPublicClient ? 'Public Client' : 'Confidential Client'}</Badge>
            </div>
            {client.description && (
              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{client.description}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-3 font-mono text-xs text-muted-foreground">
              <span>
                Client ID: <strong className="text-foreground font-semibold">{client.clientId}</strong>
              </span>
              <span>·</span>
              <span>Registered {timeAgo(client.createdAt)}</span>
              {client.suspended && client.suspendedReason && (
                <>
                  <span>·</span>
                  <span className="text-danger font-medium">Reason: {client.suspendedReason}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap shrink-0 items-center gap-2">
          {!isPublicClient && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsRotateModalOpen(true)}
              className="flex items-center gap-1.5"
            >
              <KeyRound className="size-3.5" />
              Rotate secret
            </Button>
          )}
          <Button
            variant={client.suspended ? 'secondary' : 'danger'}
            size="sm"
            onClick={() => {
              if (client.suspended) setIsUnsuspendModalOpen(true);
              else {
                setSuspendReason('');
                setSuspendConfirmText('');
                setIsSuspendModalOpen(true);
              }
            }}
          >
            {client.suspended ? 'Unsuspend app' : 'Suspend app'}
          </Button>
        </div>
      </div>

      {/* Secret Rotation Reveal Banner */}
      {rotatedSecret && (
        <SecretRevealOnce label={`New secret for ${client.clientId}`} value={rotatedSecret} />
      )}

      {/* Metrics Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div
          onClick={() => setActiveTab('activity')}
          className="cursor-pointer border-2 border-border bg-card p-5 shadow-brutal-sm transition-all hover:border-foreground/40"
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="eyebrow">Active Users (24h)</span>
            <Activity className="size-4 text-brand" />
          </div>
          <p className="mt-2 font-heading text-3xl font-bold text-foreground">{metrics.activeUsers24h}</p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">Authenticated in past 24 hours</p>
        </div>

        <div
          onClick={() => setActiveTab('activity')}
          className="cursor-pointer border-2 border-border bg-card p-5 shadow-brutal-sm transition-all hover:border-foreground/40"
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="eyebrow">Active Users (7d)</span>
            <Users className="size-4 text-ok" />
          </div>
          <p className="mt-2 font-heading text-3xl font-bold text-foreground">{metrics.activeUsers7d}</p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">Active in past 7 days</p>
        </div>

        <div
          onClick={() => setActiveTab('users')}
          className="cursor-pointer border-2 border-border bg-card p-5 shadow-brutal-sm transition-all hover:border-foreground/40"
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="eyebrow">Total Consented Users</span>
            <ShieldCheck className="size-4 text-warn" />
          </div>
          <p className="mt-2 font-heading text-3xl font-bold text-foreground">{metrics.totalAuthorizedUsers}</p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">Accounts with active authorization</p>
        </div>
      </div>

      {/* Modern Brutalist Tab Bar */}
      <div className="border-b border-border">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'group relative flex items-center gap-2 px-4 py-3 font-mono text-xs font-bold uppercase tracking-wider transition-colors shrink-0 select-none rounded-t-md hover:bg-accent/30',
                  active ? 'text-foreground font-extrabold' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon
                  className={cn(
                    'size-3.5 transition-colors',
                    active ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground',
                  )}
                />
                <span>{tab.label}</span>
                {typeof tab.count === 'number' && (
                  <span
                    className={cn(
                      'ml-0.5 rounded-full px-2 py-0.5 text-[10px] font-mono leading-none',
                      active ? 'bg-brand text-brand-foreground' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {tab.count}
                  </span>
                )}

                {/* Sliding underline indicator */}
                {active && (
                  <motion.div
                    layoutId="activeAppTabIndicator"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                    className="absolute bottom-0 inset-x-0 h-0.5 bg-brand z-10"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Panels with Smooth Transitions */}
      <div className="pt-2">
        <AnimatePresence mode="wait">
          {activeTab === 'integration' && (
            <motion.div
              key="tab-integration"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="space-y-6"
            >
              <Panel label="[ CREDENTIALS_AND_INTEGRATION ]">
                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="border border-border/50 bg-background/50 p-4 rounded-lg">
                      <span className="eyebrow text-muted-foreground">Client ID</span>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <code className="font-mono text-xs text-foreground select-all break-all">
                          {client.clientId}
                        </code>
                        <Button variant="secondary" size="sm" onClick={copyClientId} className="shrink-0">
                          {copiedClientId ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5" />}
                          <span className="ml-1 text-xs">{copiedClientId ? 'Copied' : 'Copy'}</span>
                        </Button>
                      </div>
                    </div>

                    <div className="border border-border/50 bg-background/50 p-4 rounded-lg">
                      <span className="eyebrow text-muted-foreground">Client Secret</span>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          {isPublicClient
                            ? 'Not required for public clients'
                            : '•••••••••••••••••••••••• (Hashed)'}
                        </span>
                        {!isPublicClient && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setIsRotateModalOpen(true)}
                            className="shrink-0"
                          >
                            <KeyRound className="size-3.5" />
                            <span className="ml-1 text-xs">Rotate</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-border/40 pt-5">
                    <span className="eyebrow text-muted-foreground mb-3 block">
                      Wiring & Configuration Prompt
                    </span>
                    <ConfigPromptBlock
                      clientId={client.clientId}
                      initialPrompt={configPrompt}
                      appType={isPublicClient ? 'spa' : 'web'}
                    />
                  </div>
                </div>
              </Panel>
            </motion.div>
          )}

          {activeTab === 'users' && (
            <motion.div
              key="tab-users"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
            >
              <Panel label={`[ AUTHORIZED_USERS ] (${authorizedUsers.length})`}>
                {authorizedUsers.length === 0 ? (
                  <div className="border-2 border-dashed border-border p-8 text-center">
                    <p className="text-sm text-muted-foreground">No users have authorized this app yet.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-border bg-muted/40 font-mono text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-4 py-2.5">User</th>
                          <th className="px-4 py-2.5">Granted Scopes</th>
                          <th className="px-4 py-2.5">Authorized Date</th>
                          <th className="px-4 py-2.5">Last Active</th>
                          <th className="px-4 py-2.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {authorizedUsers.map((u) => (
                          <tr key={u.userId} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                {u.profilePictureUrl ? (
                                  <img
                                    src={u.profilePictureUrl}
                                    alt={u.name}
                                    className="size-7 rounded-full border border-border object-cover"
                                  />
                                ) : (
                                  <div className="flex size-7 items-center justify-center rounded-full border border-border bg-card font-mono text-xs font-bold text-foreground">
                                    {u.name.slice(0, 1).toUpperCase()}
                                  </div>
                                )}
                                <div>
                                  <p className="font-medium text-foreground">{u.name}</p>
                                  <p className="font-mono text-xs text-muted-foreground">{u.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{u.scope}</td>
                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                              {timeAgo(u.authorizedAt)}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                              {u.lastUsedAt ? timeAgo(u.lastUsedAt) : 'Never'}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Link
                                href={`/admin/users/${u.userId}`}
                                className="inline-flex items-center gap-1 font-mono text-xs text-brand hover:underline"
                              >
                                Inspect user
                                <ExternalLink className="size-3" />
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>
            </motion.div>
          )}

          {activeTab === 'activity' && (
            <motion.div
              key="tab-activity"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
            >
              <Panel label={`[ CLIENT_ACTIVITY_LOG ] (${activity.length})`}>
                <ActivityFeed events={activity} />
              </Panel>
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div
              key="tab-settings"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="space-y-6"
            >
              <Panel label="[ EDIT_APP_SETTINGS ]">
                <form onSubmit={handleSaveSettings} className="space-y-5">
                  {saveError && <p className="font-mono text-sm text-danger">{saveError}</p>}
                  {saveStatus === 'saved' && (
                    <p className="font-mono text-sm text-ok">Settings updated successfully.</p>
                  )}

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-xs font-mono font-bold uppercase text-muted-foreground mb-1.5">
                        App Name *
                      </label>
                      <Input
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="My Application"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono font-bold uppercase text-muted-foreground mb-1.5">
                        Logo URL (Optional)
                      </label>
                      <Input
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        placeholder="https://example.com/logo.png"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-mono font-bold uppercase text-muted-foreground mb-1.5">
                      Description (Optional)
                    </label>
                    <Input
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Brief description shown on consent screens"
                    />
                  </div>

                  {/* Redirect URIs Dynamic List */}
                  <div className="space-y-2 rounded-xl border border-border/50 bg-background/40 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="block text-xs font-mono font-bold uppercase text-foreground">
                          Redirect URIs *
                        </label>
                        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                          Exact matching is enforced. Wildcards are forbidden.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={addRedirectUri}
                        className="flex items-center gap-1 text-xs"
                      >
                        <Plus className="size-3.5" />
                        Add URI
                      </Button>
                    </div>

                    <div className="space-y-2 pt-2">
                      {redirectUris.map((uri, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <Globe2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              value={uri}
                              onChange={(e) => updateRedirectUri(index, e.target.value)}
                              placeholder="http://localhost:3000/api/auth/callback/id"
                              className="pl-9 font-mono text-xs"
                              required={index === 0}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={redirectUris.length === 1}
                            onClick={() => removeRedirectUri(index)}
                            className="size-10.5 px-0 text-muted-foreground hover:border-danger hover:text-danger disabled:opacity-30"
                            title="Remove URI"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Post-Logout Redirect URIs Dynamic List */}
                  <div className="space-y-2 rounded-xl border border-border/50 bg-background/40 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="block text-xs font-mono font-bold uppercase text-foreground">
                          Post-Logout Redirect URIs (Optional)
                        </label>
                        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                          Where users should land after signing out of the identity provider.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={addPostLogoutUri}
                        className="flex items-center gap-1 text-xs"
                      >
                        <Plus className="size-3.5" />
                        Add URI
                      </Button>
                    </div>

                    {postLogoutRedirectUris.length === 0 ? (
                      <p className="py-2 font-mono text-xs text-muted-foreground italic">
                        No post-logout redirect URIs configured. Click &ldquo;Add URI&rdquo; to add one.
                      </p>
                    ) : (
                      <div className="space-y-2 pt-2">
                        {postLogoutRedirectUris.map((uri, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <Globe2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                value={uri}
                                onChange={(e) => updatePostLogoutUri(index, e.target.value)}
                                placeholder="http://localhost:3000/login"
                                className="pl-9 font-mono text-xs"
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removePostLogoutUri(index)}
                              className="size-10.5 px-0 text-muted-foreground hover:border-danger hover:text-danger"
                              title="Remove post-logout URI"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-xs font-mono font-bold uppercase text-muted-foreground mb-1.5">
                        Allowed Scopes (Space-separated)
                      </label>
                      <Input
                        value={scopesText}
                        onChange={(e) => setScopesText(e.target.value)}
                        placeholder="openid profile email"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono font-bold uppercase text-muted-foreground mb-1.5">
                        Auth Method
                      </label>
                      <select
                        value={tokenEndpointAuthMethod}
                        onChange={(e) => setTokenEndpointAuthMethod(e.target.value as any)}
                        className="h-10.5 w-full rounded-lg border border-input/60 bg-card px-3 font-mono text-xs text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="client_secret_basic">
                          client_secret_basic (Confidential - Basic Auth)
                        </option>
                        <option value="client_secret_post">
                          client_secret_post (Confidential - POST Body)
                        </option>
                        <option value="none">none (Public client / SPA / Mobile)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <Button type="submit" disabled={saveStatus === 'saving'}>
                      {saveStatus === 'saving' ? 'Saving…' : 'Save Changes'}
                    </Button>
                  </div>
                </form>
              </Panel>

              {/* Danger Zone Panel */}
              <Panel
                label="[ DANGER_ZONE ]"
                className="border-danger/40 bg-danger/5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-heading text-base font-bold text-foreground flex items-center gap-2">
                      <Flame className="size-4 text-danger" />
                      Delete this application
                    </h4>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Permanently delete this app, revoke all active user authorizations, and invalidate all live access tokens. This action is irreversible.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      setDeleteConfirmText('');
                      setIsDeleteModalOpen(true);
                    }}
                    className="shrink-0"
                  >
                    Delete application
                  </Button>
                </div>
              </Panel>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Custom Modal Dialogs (Replacing window.confirm) ── */}

      {/* 1. Suspend App Modal */}
      <Modal
        open={isSuspendModalOpen}
        onClose={() => !isSuspending && setIsSuspendModalOpen(false)}
        title="Suspend Application"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-danger/40 bg-danger/10 p-3.5 text-xs text-danger-foreground">
            <AlertTriangle className="size-5 shrink-0 text-danger" />
            <p>
              Suspending <strong>{client.clientName}</strong> will immediately refuse all authentication, token issuance, and authorization requests for Client ID <code className="font-mono text-foreground font-semibold">{client.clientId}</code>.
            </p>
          </div>

          <div>
            <label className="block text-xs font-mono font-bold uppercase text-muted-foreground mb-1.5">
              Reason for suspension (Optional)
            </label>
            <Input
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="e.g. Terms of service violation, security investigation"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-mono text-muted-foreground">
              To confirm suspension, please type <strong className="font-bold underline text-foreground">DELETE</strong> below:
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
              onClick={handleSuspendApp}
            >
              {isSuspending ? 'Suspending…' : 'Suspend Application'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 2. Reactivate / Unsuspend App Modal */}
      <Modal
        open={isUnsuspendModalOpen}
        onClose={() => !isUnsuspending && setIsUnsuspendModalOpen(false)}
        title="Reactivate Application"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Reactivate <strong>{client.clientName}</strong> (<code className="font-mono text-xs">{client.clientId}</code>)? User sign-in and token issuance will resume working immediately.
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
              onClick={handleUnsuspendApp}
            >
              {isUnsuspending ? 'Reactivating…' : 'Reactivate Application'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 3. Rotate Secret Modal */}
      <Modal
        open={isRotateModalOpen}
        onClose={() => !isRotating && setIsRotateModalOpen(false)}
        title="Rotate Client Secret"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-warn/40 bg-warn/10 p-3.5 text-xs text-foreground">
            <AlertTriangle className="size-5 shrink-0 text-warn" />
            <p>
              Generating a new secret for <strong>{client.clientName}</strong> immediately invalidates the existing secret. The new secret will be displayed <strong>once</strong>.
            </p>
          </div>

          <p className="text-xs text-muted-foreground font-mono">
            Any running instance of the application using the old secret must be updated with the newly minted secret.
          </p>

          <div className="flex justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="ghost"
              disabled={isRotating}
              onClick={() => setIsRotateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={isRotating}
              onClick={handleRotateSecret}
            >
              {isRotating ? 'Generating…' : 'Generate New Secret'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 4. Delete Application Modal (Danger Zone with DELETE typing) */}
      <Modal
        open={isDeleteModalOpen}
        onClose={() => !isDeleting && setIsDeleteModalOpen(false)}
        title="Delete Application Permanently"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-danger/40 bg-danger/10 p-3.5 text-xs text-danger-foreground">
            <Flame className="size-5 shrink-0 text-danger" />
            <p>
              This will permanently delete <strong>{client.clientName}</strong> (<code className="font-mono text-foreground">{client.clientId}</code>), drop all OAuth metadata, revoke {authorizedUsers.length} user authorizations, and invalidate all issued access tokens.
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-mono text-muted-foreground">
              To confirm permanent deletion, type <strong className="font-bold underline text-foreground">DELETE</strong> in the box below:
            </label>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type 'DELETE' to confirm"
              className="font-mono"
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="ghost"
              disabled={isDeleting}
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={deleteConfirmText !== 'DELETE' || isDeleting}
              onClick={handleDeleteApp}
            >
              {isDeleting ? 'Deleting…' : 'Permanently Delete App'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
