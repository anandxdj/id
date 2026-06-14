import bcrypt from 'bcryptjs';
import { randomBase64Url } from '../../common/utils/crypto.utils';
import OAuthClient from './oauth-client.model';
import type { IOAuthClient } from './oauth-client.model';

const makeClientId = (): string =>
  `cl_${randomBase64Url(18).replace(/[^a-zA-Z0-9_-]/g, '')}`.slice(0, 40);

const makeClientSecret = (): string => randomBase64Url(48);

export interface CreateClientInput {
  clientName: string;
  redirectUris: string[];
  description?: string;
  logoUrl?: string;
}

export interface CreatedClient {
  clientId: string;
  clientSecret: string; // returned once, never stored in plaintext
  clientName: string;
  redirectUris: string[];
}

/** Register an internal app. Returns the plaintext secret exactly once. */
export const create = async (input: CreateClientInput): Promise<CreatedClient> => {
  const clientId = makeClientId();
  const rawSecret = makeClientSecret();
  const clientSecretHash = await bcrypt.hash(rawSecret, 12);

  await OAuthClient.create({
    clientId,
    clientSecretHash,
    clientName: input.clientName.trim(),
    redirectUris: input.redirectUris,
    description: String(input.description ?? '').trim().slice(0, 2000),
    logoUrl: String(input.logoUrl ?? '').trim().slice(0, 2048),
  });

  return { clientId, clientSecret: rawSecret, clientName: input.clientName.trim(), redirectUris: input.redirectUris };
};

/** Lookup by clientId. Secret hash is excluded unless `withSecret` is set. */
export const findByClientId = async (
  clientId: string,
  { withSecret = false }: { withSecret?: boolean } = {},
): Promise<IOAuthClient | null> => {
  const q = OAuthClient.findOne({ clientId });
  if (withSecret) q.select('+clientSecretHash');
  return q.lean<IOAuthClient>();
};

export const verifyClientSecret = async (
  client: { clientSecretHash?: string } | null,
  plainSecret: string,
): Promise<boolean> => {
  if (!client?.clientSecretHash) return false;
  return bcrypt.compare(plainSecret, client.clientSecretHash);
};

/** List all registered clients, newest first (admin view). Never includes secrets. */
export const list = async (): Promise<IOAuthClient[]> =>
  OAuthClient.find().sort({ createdAt: -1 }).lean<IOAuthClient[]>();

export interface UpdateClientInput {
  clientName?: string;
  redirectUris?: string[];
  description?: string;
  logoUrl?: string;
}

/** Patch a client's editable fields (admin). Returns the updated doc or null. */
export const update = async (
  clientId: string,
  input: UpdateClientInput,
): Promise<IOAuthClient | null> => {
  const set: Record<string, unknown> = {};
  if (input.clientName !== undefined) set.clientName = input.clientName.trim();
  if (input.redirectUris !== undefined) set.redirectUris = input.redirectUris;
  if (input.description !== undefined) set.description = String(input.description).trim().slice(0, 2000);
  if (input.logoUrl !== undefined) set.logoUrl = String(input.logoUrl).trim().slice(0, 2048);
  return OAuthClient.findOneAndUpdate({ clientId }, { $set: set }, { new: true, runValidators: true }).lean<IOAuthClient>();
};

/** Issue a fresh secret for a client, invalidating the old one. Returns it once. */
export const rotateSecret = async (
  clientId: string,
): Promise<{ clientSecret: string } | null> => {
  const rawSecret = makeClientSecret();
  const clientSecretHash = await bcrypt.hash(rawSecret, 12);
  const updated = await OAuthClient.findOneAndUpdate({ clientId }, { $set: { clientSecretHash } });
  if (!updated) return null;
  return { clientSecret: rawSecret };
};

/** Suspend or unsuspend a client. A suspended client is rejected at authorize/token. */
export const setSuspended = async (
  clientId: string,
  suspended: boolean,
  reason?: string,
): Promise<IOAuthClient | null> => {
  const update = suspended
    ? { $set: { suspended: true, suspendedReason: reason ?? '', suspendedAt: new Date() } }
    : { $set: { suspended: false }, $unset: { suspendedReason: '', suspendedAt: '' } };
  return OAuthClient.findOneAndUpdate({ clientId }, update, { new: true }).lean<IOAuthClient>();
};

/** Idempotent upsert used by the seed script — keeps a fixed clientId, (re)issues a secret. */
export const upsertSeedClient = async (
  clientId: string,
  input: CreateClientInput,
): Promise<{ clientId: string; clientSecret: string; created: boolean }> => {
  const rawSecret = makeClientSecret();
  const clientSecretHash = await bcrypt.hash(rawSecret, 12);
  const existing = await OAuthClient.findOne({ clientId });

  await OAuthClient.findOneAndUpdate(
    { clientId },
    {
      clientId,
      clientSecretHash,
      clientName: input.clientName.trim(),
      redirectUris: input.redirectUris,
      description: String(input.description ?? '').trim().slice(0, 2000),
      logoUrl: String(input.logoUrl ?? '').trim().slice(0, 2048),
    },
    { upsert: true, new: true },
  );

  return { clientId, clientSecret: rawSecret, created: !existing };
};
