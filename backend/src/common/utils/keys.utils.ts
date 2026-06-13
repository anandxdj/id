import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { generateKeyPairSync } from 'node:crypto';
import jose from 'node-jose';

const DEFAULT_CERT_PATH = path.resolve(process.cwd(), 'cert', 'private-key.pem');

let signingKey: jose.JWK.Key | undefined;
let jwksCache: { keys: unknown[] } = { keys: [] };
let activeKid = 'oidc-1';

/** Issuer without trailing slash. */
export const getOidcIssuer = (): string => {
  const fromEnv = process.env.OIDC_ISSUER?.replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  const port = process.env.PORT || 4000;
  return `http://localhost:${port}`;
};

const loadPem = (): string => {
  const inline = process.env.OIDC_RSA_PRIVATE_KEY;
  if (inline) {
    return inline.replace(/\\n/g, '\n');
  }

  const keyPath = process.env.OIDC_RSA_PRIVATE_KEY_PATH;
  if (keyPath) {
    return readFileSync(path.resolve(keyPath), 'utf8');
  }

  if (existsSync(DEFAULT_CERT_PATH)) {
    return readFileSync(DEFAULT_CERT_PATH, 'utf8');
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Set OIDC_RSA_PRIVATE_KEY, OIDC_RSA_PRIVATE_KEY_PATH, or add backend/cert/private-key.pem (pnpm oidc:generate-keys)',
    );
  }

  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  console.warn(
    '[OIDC] No signing key configured: using ephemeral RSA (dev). Keys rotate on every restart. Persist a PEM in production.',
  );
  return privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
};

/** Call once at startup, after env is loaded. */
export const initOidcKeys = async (): Promise<void> => {
  activeKid = process.env.OIDC_KEY_ID || 'oidc-1';
  const pem = loadPem();
  signingKey = await jose.JWK.asKey(pem, 'pem');

  const publicJwk = signingKey.toJSON() as Record<string, unknown>;
  jwksCache = {
    keys: [{ ...publicJwk, kid: activeKid, use: 'sig', alg: 'RS256' }],
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
    { format: 'compact', fields: { alg: 'RS256', typ: 'JWT', kid: activeKid } },
    signingKey,
  )
    .update(payload, 'utf8')
    .final() as unknown as Promise<string>;
};
