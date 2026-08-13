/**
 * find-or-create + verified-email linking for social connectors. Requires Mongo;
 * self-skips when unavailable (runs in CI / when `pnpm db:up`).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { NormalizedProfile } from './connectors/types';
import { IntegrationGate } from '../../common/testing/index.testing';

process.env.MONGO_DB_NAME ??= 'id_test';

let available = false;

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<T>((_, r) => setTimeout(() => r(new Error('timeout')), ms))]);

const EMAILS = ['social-new@example.com', 'social-link@example.com', 'social-unverified@example.com'];

before(async () => {
  try {
    const mongoose = (await import('mongoose')).default;
    await withTimeout(
      mongoose.connect(process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017', {
        dbName: process.env.MONGO_DB_NAME,
        serverSelectionTimeoutMS: 1500,
      }),
      2000,
    );
    const { User } = await import('./auth.model');
    const Identity = (await import('./identity.model')).default;
    await User.deleteMany({ email: { $in: EMAILS } });
    await Identity.deleteMany({ providerAccountId: { $in: ['g-new', 'g-link', 'h-unverified', 'g-repeat'] } });
    available = true;
  } catch (cause) {
    available = false;
    try {
      const mongoose = (await import('mongoose')).default;
      await mongoose.disconnect();
    } catch { /* ignore */ }
    IntegrationGate.reportUnavailable('social.integration', cause);
  }
});

after(async () => {
  if (available) {
    const mongoose = (await import('mongoose')).default;
    const { User } = await import('./auth.model');
    const Identity = (await import('./identity.model')).default;
    await User.deleteMany({ email: { $in: EMAILS } });
    await Identity.deleteMany({ providerAccountId: { $in: ['g-new', 'g-link', 'h-unverified', 'g-repeat'] } });
    await mongoose.disconnect();
  }
});

test('creates a new user + identity for an unknown verified profile', async (t) => {
  if (!available) return t.skip('Mongo not reachable');
  const { findOrCreateFromProfile } = await import('./social.service');
  const Identity = (await import('./identity.model')).default;

  const profile: NormalizedProfile = {
    provider: 'google',
    providerAccountId: 'g-new',
    email: 'social-new@example.com',
    emailVerified: true,
    name: 'New Social',
  };
  const user = await findOrCreateFromProfile(profile);
  assert.equal(user.email, 'social-new@example.com');
  assert.equal(user.isVerified, true);
  assert.equal(user.password, undefined, 'social user has no password');
  const identity = await Identity.findOne({ provider: 'google', providerAccountId: 'g-new' });
  assert.ok(identity);
  assert.equal(identity!.userId.toString(), user._id.toString());
});

test('repeating the same identity returns the same user (no duplicate)', async (t) => {
  if (!available) return t.skip('Mongo not reachable');
  const { findOrCreateFromProfile } = await import('./social.service');
  const { User } = await import('./auth.model');

  const profile: NormalizedProfile = {
    provider: 'google',
    providerAccountId: 'g-repeat',
    email: 'social-new@example.com', // same email as the first user
    emailVerified: true,
  };
  const first = await findOrCreateFromProfile(profile);
  const second = await findOrCreateFromProfile(profile);
  assert.equal(first._id.toString(), second._id.toString());
  assert.equal(await User.countDocuments({ email: 'social-new@example.com' }), 1);
});

test('links a verified profile to an existing user by email', async (t) => {
  if (!available) return t.skip('Mongo not reachable');
  const { findOrCreateFromProfile } = await import('./social.service');
  const { User } = await import('./auth.model');
  const Identity = (await import('./identity.model')).default;

  // Pre-existing password user.
  const existing = await User.create({
    name: 'Existing',
    email: 'social-link@example.com',
    password: 'password123',
  });

  const linked = await findOrCreateFromProfile({
    provider: 'github',
    providerAccountId: 'g-link',
    email: 'social-link@example.com',
    emailVerified: true,
    name: 'Existing GH',
  });
  assert.equal(linked._id.toString(), existing._id.toString(), 'linked to the existing user, not a new one');
  const identity = await Identity.findOne({ provider: 'github', providerAccountId: 'g-link' });
  assert.equal(identity!.userId.toString(), existing._id.toString());
});

test('does NOT link an UNVERIFIED profile to an existing user (creates separate)', async (t) => {
  if (!available) return t.skip('Mongo not reachable');
  const { findOrCreateFromProfile } = await import('./social.service');
  const { User } = await import('./auth.model');

  await User.create({ name: 'Owner', email: 'social-unverified@example.com', password: 'password123' });
  const initialCount = await User.countDocuments({ email: 'social-unverified@example.com' });
  assert.equal(initialCount, 1);

  // Unverified email must not auto-link (account-takeover guard). It also cannot create a
  // second user with the same email (unique index), so this must reject.
  await assert.rejects(
    findOrCreateFromProfile({
      provider: 'github',
      providerAccountId: 'h-unverified',
      email: 'social-unverified@example.com',
      emailVerified: false,
      name: 'Attacker',
    }),
    'unverified email collision is rejected rather than silently linked',
  );
});
