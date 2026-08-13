import { randomBase64Url } from '../../common/utils/crypto.utils';
import { ClientSecretUtil } from '../../common/utils/clientSecret.utils';
import { CLIENT_ID, TOKEN_ENDPOINT_AUTH_METHODS } from '../../common/constants/index.constants';
import { Logger } from '../../common/logger/index.logger';
import OAuthClient from './oauth-client.model';
import type { IOAuthClient } from './oauth-client.model';

const makeClientId = (): string =>
  `${CLIENT_ID.PREFIX}${randomBase64Url(18).replace(/[^a-zA-Z0-9_-]/g, '')}`.slice(0, CLIENT_ID.MAX_LENGTH);

/** M4: protocol metadata accepted at registration. Omitted fields take model defaults. */
export interface ClientProtocolMetadata {
  scopes?: string[];
  grantTypes?: string[];
  responseTypes?: string[];
  tokenEndpointAuthMethod?: string;
  postLogoutRedirectUris?: string[];
}

export interface CreateClientInput extends ClientProtocolMetadata {
  clientName: string;
  redirectUris: string[];
  description?: string;
  logoUrl?: string;
}

export interface CreatedClient {
  clientId: string;
  /** Returned once, never stored in plaintext. Absent entirely for a public client. */
  clientSecret?: string;
  clientName: string;
  redirectUris: string[];
  tokenEndpointAuthMethod: string;
}

/** True when the client authenticates with `none` — i.e. an SPA or native app. */
const isPublicMethod = (method?: string): boolean =>
  method === TOKEN_ENDPOINT_AUTH_METHODS.NONE;

// Internal: only set the keys the caller actually supplied, so an update never
// clobbers a stored policy with a model default.
const _metadataUpdate = (input: ClientProtocolMetadata): Record<string, unknown> => {
  const set: Record<string, unknown> = {};
  if (input.scopes !== undefined) set.scopes = input.scopes;
  if (input.grantTypes !== undefined) set.grantTypes = input.grantTypes;
  if (input.responseTypes !== undefined) set.responseTypes = input.responseTypes;
  if (input.tokenEndpointAuthMethod !== undefined) {
    set.tokenEndpointAuthMethod = input.tokenEndpointAuthMethod;
  }
  if (input.postLogoutRedirectUris !== undefined) {
    set.postLogoutRedirectUris = input.postLogoutRedirectUris;
  }
  return set;
};

/**
 * Register an app. Returns the plaintext secret exactly once — and not at all for a
 * public client, which must have no secret rather than an unused one.
 */
export const create = async (input: CreateClientInput): Promise<CreatedClient> => {
  const clientId = makeClientId();
  const publicClient = isPublicMethod(input.tokenEndpointAuthMethod);
  const rawSecret = publicClient ? undefined : ClientSecretUtil.generate();
  const clientSecretHash = rawSecret ? ClientSecretUtil.digest(rawSecret) : undefined;

  const created = await OAuthClient.create({
    clientId,
    clientSecretHash,
    clientName: input.clientName.trim(),
    redirectUris: input.redirectUris,
    description: String(input.description ?? '').trim().slice(0, 2000),
    logoUrl: String(input.logoUrl ?? '').trim().slice(0, 2048),
    ..._metadataUpdate(input),
  });

  return {
    clientId,
    clientSecret: rawSecret,
    clientName: input.clientName.trim(),
    redirectUris: input.redirectUris,
    tokenEndpointAuthMethod: created.tokenEndpointAuthMethod,
  };
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

/**
 * Verify a presented secret against the stored digest.
 *
 * `needsUpgrade` reports that the match came from the bcrypt verify-only fallback and
 * the stored value should be rewritten — see `upgradeSecretDigest`. The caller decides
 * when to act on it, because this function does not know whether it is running somewhere
 * a write is appropriate.
 */
export const verifyClientSecret = async (
  client: { clientSecretHash?: string } | null,
  plainSecret: string,
): Promise<{ ok: boolean; needsUpgrade: boolean }> =>
  ClientSecretUtil.verify(client?.clientSecretHash, plainSecret);

/**
 * Rewrite a legacy bcrypt hash as a SHA-256 digest, after that hash has just been used
 * to authenticate successfully. This is the whole migration: no client is re-registered
 * and no secret changes, so the first successful call after deploy silently moves the
 * record forward and every call after it takes the fast path.
 *
 * The update is a compare-and-swap on the exact hash that was verified. A blind
 * `$set` would race an administrator rotating the secret in the same window and
 * overwrite the new credential with a digest of the old one — locking the client out
 * until it rotated again. Matching on `expectedHash` means a concurrent rotation simply
 * makes this a no-op, which is the correct outcome: the value we would have written is
 * already stale. Single-document atomic, so no transaction is involved.
 */
export const upgradeSecretDigest = async (
  clientId: string,
  expectedHash: string | undefined,
  plainSecret: string,
): Promise<boolean> => {
  if (!expectedHash) return false;
  try {
    const result = await OAuthClient.updateOne(
      { clientId, clientSecretHash: expectedHash },
      { $set: { clientSecretHash: ClientSecretUtil.digest(plainSecret) } },
    );
    return result.modifiedCount > 0;
  } catch (error) {
    // Never fatal: the client authenticated correctly and is entitled to its token.
    // Losing the upgrade only means paying the bcrypt cost again next time.
    Logger.error('Client secret digest upgrade failed', { clientId, error });
    return false;
  }
};

/** List all registered clients, newest first (admin view). Never includes secrets. */
export const list = async (): Promise<IOAuthClient[]> =>
  OAuthClient.find().sort({ createdAt: -1 }).lean<IOAuthClient[]>();

export interface UpdateClientInput extends ClientProtocolMetadata {
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
  const set: Record<string, unknown> = _metadataUpdate(input);
  if (input.clientName !== undefined) set.clientName = input.clientName.trim();
  if (input.redirectUris !== undefined) set.redirectUris = input.redirectUris;
  if (input.description !== undefined) set.description = String(input.description).trim().slice(0, 2000);
  if (input.logoUrl !== undefined) set.logoUrl = String(input.logoUrl).trim().slice(0, 2048);
  return OAuthClient.findOneAndUpdate({ clientId }, { $set: set }, { new: true, runValidators: true }).lean<IOAuthClient>();
};

/**
 * Issue a fresh secret for a client, invalidating the old one. Returns it once.
 *
 * Refuses on a public client: minting a secret for a client registered as `none` would
 * create a credential the token endpoint is contractually obliged to reject, which is
 * worse than no credential at all.
 */
export const rotateSecret = async (
  clientId: string,
): Promise<{ clientSecret: string } | null> => {
  const existing = await OAuthClient.findOne({ clientId }).lean<IOAuthClient>();
  if (!existing) return null;
  if (isPublicMethod(existing.tokenEndpointAuthMethod)) return null;

  const rawSecret = ClientSecretUtil.generate();
  const clientSecretHash = ClientSecretUtil.digest(rawSecret);
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
  const rawSecret = ClientSecretUtil.generate();
  const clientSecretHash = ClientSecretUtil.digest(rawSecret);
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
      ..._metadataUpdate(input),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return { clientId, clientSecret: rawSecret, created: !existing };
};
