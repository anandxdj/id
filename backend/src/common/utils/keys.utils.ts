import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { generateKeyPairSync } from 'node:crypto';
import jose from 'node-jose';
import { Config } from '../config/config';
import { Logger } from '../logger/index.logger';
import { CRYPTO } from '../constants/index.constants';

const DEFAULT_CERT_PATH = path.resolve(process.cwd(), 'cert', 'private-key.pem');
const RSA_MODULUS_LENGTH = 2048;

let signingKey: jose.JWK.Key | undefined;
let jwksCache: { keys: unknown[] } = { keys: [] };
let activeKid = '';

/** Issuer without trailing slash. */
export const getOidcIssuer = (): string => Config.oidc.issuer;

const loadPem = (): string => {
  const inline = Config.oidc.privateKeyPem;
  if (inline) {
    return inline.replace(/\\n/g, '\n');
  }

  const keyPath = Config.oidc.privateKeyPath;
  if (keyPath) {
    return readFileSync(path.resolve(keyPath), 'utf8');
  }

  if (existsSync(DEFAULT_CERT_PATH)) {
    return readFileSync(DEFAULT_CERT_PATH, 'utf8');
  }

  // The config layer already refuses to boot in production without a configured key,
  // so reaching here means development.
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: RSA_MODULUS_LENGTH });
  Logger.warn(
    'No OIDC signing key configured — using an ephemeral RSA key. Every restart invalidates previously issued tokens.',
  );
  return privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
};

/** Call once at startup, after config has been validated. */
export const initOidcKeys = async (): Promise<void> => {
  activeKid = Config.oidc.keyId;
  const pem = loadPem();
  signingKey = await jose.JWK.asKey(pem, 'pem');

  const publicJwk = signingKey.toJSON() as Record<string, unknown>;
  jwksCache = {
    keys: [{ ...publicJwk, kid: activeKid, use: 'sig', alg: CRYPTO.SIGNING_ALG }],
  };
};

export const getJwksDocument = (): { keys: unknown[] } => jwksCache;

export const getKeyId = (): string => activeKid;

/** Sign an RS256 compact JWT. `claims` carries iss, sub, aud, iat, exp, and optional nonce/email/name. */
export const signIdToken = async (claims: Record<string, unknown>): Promise<string> => {
  if (!signingKey) {
    throw new Error('initOidcKeys() must be called before signIdToken');
  }
  const payload = JSON.stringify(claims);
  return jose.JWS.createSign(
    { format: 'compact', fields: { alg: CRYPTO.SIGNING_ALG, typ: 'JWT', kid: activeKid } },
    signingKey,
  )
    .update(payload, 'utf8')
    .final() as unknown as Promise<string>;
};
