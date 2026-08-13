import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { KeyObject } from 'node:crypto';
import mongoose from 'mongoose';
import { Config } from '../../common/config/config';
import { Logger } from '../../common/logger/index.logger';
import { KeyringUtil } from '../../common/utils/keyring.utils';
import type { RsaPublicJwk } from '../../common/utils/keyring.utils';
import {
  MILLISECONDS,
  SIGNING_KEY,
  SIGNING_KEY_STATUS,
} from '../../common/constants/index.constants';
import type { SigningKeyStatus } from '../../common/constants/index.constants';
import { SigningKeyStore } from './signing-key.store';
import type { IOAuthSigningKey } from './oauth-signing-key.model';

/**
 * The signing keyring: which key signs, which keys still verify, and when a rotated-out
 * key finally stops counting.
 *
 * Three properties the reference implementation has none of (plan §2.3-5):
 *
 *  - **The `kid` is the key.** It is the RFC 7638 thumbprint, so it changes when — and
 *    only when — the key changes. A literal `"default"` cannot express a second key.
 *  - **Rotation has an overlap window.** The outgoing key becomes RETIRED with a
 *    `notAfter`, stays in JWKS, and keeps verifying until that passes. Without it,
 *    rotating invalidates every token in flight and every RP's cached JWKS.
 *  - **Private keys are encrypted at rest.** A database dump yields ciphertext, not
 *    the ability to mint an ID token for any user of any relying party.
 *
 * The in-memory keyring is a cache of the collection, refreshed on a `kid` miss so a
 * rotation performed by one replica is picked up by the others without a restart.
 */

const DEFAULT_CERT_PATH = path.resolve(process.cwd(), 'cert', 'private-key.pem');

/** How long to wait before re-reading the collection after an unknown `kid`. */
const KID_MISS_REFRESH_INTERVAL_MS = 30 * MILLISECONDS.SECOND;

interface LoadedKey {
  kid: string;
  alg: string;
  publicJwk: RsaPublicJwk;
  publicKey: KeyObject;
  /** Absent when the row could not be decrypted — it can still verify, never sign. */
  privateKey?: KeyObject;
  status: SigningKeyStatus;
  notAfter: Date | null;
}

export interface VerifiedJws {
  header: Record<string, unknown>;
  claims: Record<string, unknown>;
  kid: string;
}

let keyring: LoadedKey[] = [];
let activeKid = '';
/** True once the keyring is backed by the collection rather than a local fallback. */
let persisted = false;
let lastRefreshAttempt = 0;

// ── Internal helpers ─────────────────────────────────────────────────────────

const _kek = (): Buffer => KeyringUtil.deriveKek(Config.oidc.keyEncryptionKey);

const _dbReady = (): boolean => mongoose.connection.readyState === 1;

/**
 * Internal: the PEM this deployment was configured with, or a fresh one.
 *
 * Only reached when the collection has no ACTIVE key — i.e. first boot. Config refuses
 * to start production without a configured key, so the generated branch is development.
 */
const _configuredOrFreshPem = (): { pem: string; generated: boolean } => {
  const inline = Config.oidc.privateKeyPem;
  if (inline) return { pem: inline.replace(/\\n/g, '\n'), generated: false };

  const keyPath = Config.oidc.privateKeyPath;
  if (keyPath) return { pem: readFileSync(path.resolve(keyPath), 'utf8'), generated: false };

  if (existsSync(DEFAULT_CERT_PATH)) {
    return { pem: readFileSync(DEFAULT_CERT_PATH, 'utf8'), generated: false };
  }

  return { pem: KeyringUtil.generatePrivateKeyPem(), generated: true };
};

/** Internal: PEM → the in-memory shape, with the thumbprint as its identity. */
const _loadFromPem = (pem: string, status: SigningKeyStatus): LoadedKey => {
  const privateKey = KeyringUtil.privateKeyFromPem(pem);
  const publicJwk = KeyringUtil.publicJwkOf(privateKey);
  return {
    kid: KeyringUtil.thumbprint(publicJwk),
    alg: KeyringUtil.algorithm,
    publicJwk,
    publicKey: KeyringUtil.publicKeyFromJwk(publicJwk),
    privateKey,
    status,
    notAfter: null,
  };
};

/**
 * Internal: a stored row → the in-memory shape.
 *
 * A row that will not decrypt is kept as verify-only rather than dropped. It was
 * written under a different KEK, and silently discarding it would stop honouring
 * tokens that are still perfectly valid; refusing to *sign* with it is the only part
 * that actually matters.
 */
const _loadFromRow = (row: IOAuthSigningKey): LoadedKey => {
  const publicJwk = row.publicJwk as unknown as RsaPublicJwk;
  const loaded: LoadedKey = {
    kid: row.kid,
    alg: row.alg,
    publicJwk,
    publicKey: KeyringUtil.publicKeyFromJwk(publicJwk),
    status: row.status,
    notAfter: row.notAfter ?? null,
  };

  try {
    loaded.privateKey = KeyringUtil.privateKeyFromPem(
      KeyringUtil.decryptPrivateKey(
        {
          ciphertext: row.encryptedPrivateKey,
          iv: row.encryptionIv,
          authTag: row.encryptionAuthTag,
        },
        _kek(),
      ),
    );
  } catch (error) {
    Logger.error('Stored signing key could not be decrypted — kept for verification only', {
      kid: row.kid,
      status: row.status,
      error,
    });
  }

  return loaded;
};

/** Internal: persist a key, tolerating a concurrent replica having inserted it first. */
const _persist = async (key: LoadedKey, pem: string): Promise<void> => {
  const envelope = KeyringUtil.encryptPrivateKey(pem, _kek());
  try {
    await SigningKeyStore.create({
      kid: key.kid,
      alg: key.alg,
      publicJwk: key.publicJwk as unknown as Record<string, string>,
      encryptedPrivateKey: envelope.ciphertext,
      encryptionIv: envelope.iv,
      encryptionAuthTag: envelope.authTag,
      status: key.status,
    });
  } catch (error) {
    // `kid` is unique and derived from the key, so a duplicate means another replica
    // seeded the identical key first. That is the desired end state, not a failure.
    if ((error as { code?: number }).code === 11000) {
      Logger.info('Signing key already present — another replica seeded it first', {
        kid: key.kid,
      });
      return;
    }
    throw error;
  }
};

/** Internal: replace the in-memory keyring from the collection. */
const _hydrate = async (): Promise<void> => {
  const rows = await SigningKeyStore.listPublished();
  keyring = rows.map(_loadFromRow);
  activeKid = keyring.find((k) => k.status === SIGNING_KEY_STATUS.ACTIVE)?.kid ?? '';
  persisted = true;
  lastRefreshAttempt = Date.now();
};

// ── Service ──────────────────────────────────────────────────────────────────

export const SigningKeyService = {
  /**
   * Bring the keyring up. Call once at boot, after config validation.
   *
   * Falls back to a process-local keyring when Mongo is not connected. That is not a
   * security compromise — an identity provider with no database cannot serve anything
   * anyway, and `/ready` reports it — but it does keep the pure protocol surface
   * (discovery, JWKS, parameter validation) testable and bootable without one.
   */
  async init(): Promise<void> {
    if (_dbReady()) {
      await _hydrate();
      if (activeKid) {
        Logger.info('OIDC signing keyring loaded', {
          kid: activeKid,
          published: keyring.length,
        });
        return;
      }

      const { pem, generated } = _configuredOrFreshPem();
      const seeded = _loadFromPem(pem, SIGNING_KEY_STATUS.ACTIVE);
      await _persist(seeded, pem);
      await _hydrate();
      Logger.info('OIDC signing keyring seeded', { kid: activeKid, generated });
      return;
    }

    const { pem, generated } = _configuredOrFreshPem();
    const local = _loadFromPem(pem, SIGNING_KEY_STATUS.ACTIVE);
    keyring = [local];
    activeKid = local.kid;
    persisted = false;
    if (generated) {
      Logger.warn(
        'No OIDC signing key configured and no database connection — using an ephemeral in-process key. Every restart invalidates previously issued tokens.',
      );
    }
  },

  /** `kid` of the key currently signing. Empty only before `init()`. */
  activeKid(): string {
    return activeKid;
  },

  /**
   * The JWKS document: ACTIVE + NEXT + every RETIRED key still inside its overlap
   * window. Pure read — the reference triggers a write-path key-sync on every
   * unauthenticated request to this endpoint.
   */
  jwks(): { keys: Array<Record<string, unknown>> } {
    const now = Date.now();
    return {
      keys: keyring
        .filter((key) => key.notAfter === null || key.notAfter.getTime() > now)
        .map((key) => ({ ...key.publicJwk, kid: key.kid, use: 'sig', alg: key.alg })),
    };
  },

  /** Sign a compact JWS with the active key, stamping `alg`, `typ` and `kid`. */
  sign(claims: Record<string, unknown>, options: { typ: string }): string {
    const active = keyring.find((key) => key.kid === activeKid && key.privateKey);
    if (!active?.privateKey) {
      throw new Error('SigningKeyService.init() must complete before signing');
    }
    return KeyringUtil.signCompact(
      { alg: active.alg, typ: options.typ, kid: active.kid },
      claims,
      active.privateKey,
    );
  },

  /**
   * Verify a compact JWS against whichever published key its `kid` names.
   *
   * `typ` is checked here rather than by the caller because forgetting it is exactly
   * how token type confusion happens — an ID token and an access token are both
   * RS256 signatures from the same keyring, and the header is the first thing that
   * tells them apart.
   *
   * Returns `null` for every failure. The caller turns that into one generic
   * `invalid_token`; distinguishing "unknown kid" from "bad signature" would leak.
   */
  async verify(token: string, options: { typ: string }): Promise<VerifiedJws | null> {
    const header = KeyringUtil.decodeHeader(token);
    if (!header) return null;
    if (header.alg !== KeyringUtil.algorithm) return null;
    if (header.typ !== options.typ) return null;

    const kid = typeof header.kid === 'string' ? header.kid : '';
    if (!kid) return null;

    const key = await this._resolveKid(kid);
    if (!key) return null;
    if (key.notAfter !== null && key.notAfter.getTime() <= Date.now()) return null;
    if (!KeyringUtil.verifyCompact(token, key.publicKey)) return null;

    const claims = KeyringUtil.decodeClaims(token);
    if (!claims) return null;

    return { header, claims, kid };
  },

  /**
   * Rotate: mint a new ACTIVE key and give the outgoing one an overlap window.
   *
   * Two ordinary single-document writes, no transaction. The new key is inserted
   * first, so the only crash window leaves two ACTIVE rows — both published, both
   * verifying, one arbitrarily chosen to sign. Retiring first would instead leave the
   * ring with no signer at all, which is an outage rather than a wrinkle.
   */
  async rotate(): Promise<{ previousKid: string | null; kid: string }> {
    if (!_dbReady()) {
      throw new Error('Signing-key rotation requires a database connection');
    }

    const previous = await SigningKeyStore.findActive();
    const pem = KeyringUtil.generatePrivateKeyPem();
    const next = _loadFromPem(pem, SIGNING_KEY_STATUS.ACTIVE);

    await _persist(next, pem);

    if (previous && previous.kid !== next.kid) {
      const notAfter = new Date(
        Date.now() + Config.oidc.keyRotationOverlapSeconds * MILLISECONDS.SECOND,
      );
      await SigningKeyStore.retireActive(previous.kid, notAfter);
      Logger.info('Signing key retired with an overlap window', {
        kid: previous.kid,
        notAfter,
      });
    }

    await _hydrate();
    Logger.info('Signing key rotated', { kid: activeKid, previousKid: previous?.kid ?? null });
    return { previousKid: previous?.kid ?? null, kid: activeKid };
  },

  /**
   * Internal: find a key by `kid`, re-reading the collection at most once per interval
   * when it is not already in memory. The throttle matters — without it, a stream of
   * tokens carrying garbage `kid`s becomes a database read per request.
   */
  async _resolveKid(kid: string): Promise<LoadedKey | undefined> {
    const known = keyring.find((key) => key.kid === kid);
    if (known) return known;
    if (!persisted || !_dbReady()) return undefined;
    if (Date.now() - lastRefreshAttempt < KID_MISS_REFRESH_INTERVAL_MS) return undefined;

    await _hydrate();
    return keyring.find((key) => key.kid === kid);
  },

  /** Test-only: drop the in-memory ring so the next `init()` re-reads from scratch. */
  _reset(): void {
    keyring = [];
    activeKid = '';
    persisted = false;
    lastRefreshAttempt = 0;
  },

  /** Force a re-read of the collection. Used by rotation tests and ops tooling. */
  async refresh(): Promise<void> {
    if (_dbReady()) await _hydrate();
  },
};
