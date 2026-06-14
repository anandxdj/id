'use client';

import { useEffect, useState } from 'react';
import * as accountApi from '@/features/account/services/accountApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ProfileData } from '@/types';

type Editable = Pick<ProfileData, 'name' | 'jobTitle' | 'company' | 'country' | 'bio' | 'profilePictureUrl'>;
const FIELDS: { key: keyof Editable; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'jobTitle', label: 'Job title' },
  { key: 'company', label: 'Company' },
  { key: 'country', label: 'Country (2-letter)' },
  { key: 'profilePictureUrl', label: 'Profile picture URL' },
];

export function ProfileForm() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [form, setForm] = useState<Editable | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    accountApi
      .getProfile()
      .then((p) => {
        setProfile(p);
        setForm({ name: p.name, jobTitle: p.jobTitle, company: p.company, country: p.country, bio: p.bio, profilePictureUrl: p.profilePictureUrl });
      })
      .catch((e) => setError(e.message));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setStatus('');
    setError('');
    try {
      const updated = await accountApi.updateProfile(form);
      setProfile(updated);
      setStatus('Saved');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (error && !form) return <p className="font-mono text-sm text-danger">{error}</p>;
  if (!profile || !form) return <p className="eyebrow text-muted-foreground">LOADING…</p>;

  return (
    <form onSubmit={save} className="max-w-md space-y-4">
      <div>
        <Label>Email</Label>
        <Input value={profile.email} disabled />
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          Email and role are managed by an administrator.
        </p>
      </div>
      {FIELDS.map((f) => (
        <div key={f.key}>
          <Label>{f.label}</Label>
          <Input
            value={form[f.key] ?? ''}
            onChange={(e) => setForm((prev) => (prev ? { ...prev, [f.key]: e.target.value } : prev))}
          />
        </div>
      ))}
      <div>
        <Label>Bio</Label>
        <textarea
          value={form.bio ?? ''}
          onChange={(e) => setForm((prev) => (prev ? { ...prev, bio: e.target.value } : prev))}
          rows={3}
          className="w-full border-2 border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
        />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
        {status && <span className="font-mono text-xs font-bold uppercase text-ok">{status}</span>}
        {error && <span className="font-mono text-xs font-bold text-danger">{error}</span>}
      </div>
    </form>
  );
}
