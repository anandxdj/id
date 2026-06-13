import crypto from 'node:crypto';

const base64Url = (buf: Buffer): string =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

/** PKCE S256: BASE64URL(SHA256(verifier)) without padding. */
export const pkceChallengeS256 = (codeVerifier: string): string => {
  const hash = crypto.createHash('sha256').update(codeVerifier, 'utf8').digest();
  return base64Url(hash);
};

/** Constant-time compare of the derived challenge against the stored one. */
export const verifyPkce = (codeVerifier: string, codeChallenge: string): boolean => {
  if (!codeChallenge || !codeVerifier) return false;
  const expected = pkceChallengeS256(codeVerifier);
  try {
    const b1 = Buffer.from(expected, 'utf8');
    const b2 = Buffer.from(String(codeChallenge), 'utf8');
    if (b1.length !== b2.length) return false;
    return crypto.timingSafeEqual(b1, b2);
  } catch {
    return false;
  }
};

export const randomBase64Url = (byteLength = 32): string => base64Url(crypto.randomBytes(byteLength));

export const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(String(token), 'utf8').digest('hex');
