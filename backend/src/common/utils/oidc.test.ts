import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { pkceChallengeS256, verifyPkce, hashToken, randomBase64Url } from './crypto.utils';
import { initOidcKeys, getJwksDocument, signIdToken, getOidcIssuer } from './keys.utils';

// ── PKCE (RFC 7636 test vector) ─────────────────────────────────────────────
test('pkceChallengeS256 matches the RFC 7636 example vector', () => {
  const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
  const expected = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
  assert.equal(pkceChallengeS256(verifier), expected);
});

test('verifyPkce true for matching pair, false for mismatch and empties', () => {
  const verifier = randomBase64Url(32);
  const challenge = pkceChallengeS256(verifier);
  assert.equal(verifyPkce(verifier, challenge), true);
  assert.equal(verifyPkce(verifier, pkceChallengeS256('other')), false);
  assert.equal(verifyPkce('', challenge), false);
  assert.equal(verifyPkce(verifier, ''), false);
});

test('hashToken is stable hex; randomBase64Url has no +/= chars', () => {
  assert.equal(hashToken('abc'), hashToken('abc'));
  assert.match(hashToken('abc'), /^[0-9a-f]{64}$/);
  const r = randomBase64Url(32);
  assert.doesNotMatch(r, /[+/=]/);
});

// ── Key infra ────────────────────────────────────────────────────────────────
test('initOidcKeys publishes a public JWKS with kid/use/alg and no private fields', async () => {
  await initOidcKeys();
  const doc = getJwksDocument();
  assert.equal(doc.keys.length, 1);
  const jwk = doc.keys[0] as Record<string, unknown>;
  assert.ok(jwk.kid);
  assert.equal(jwk.use, 'sig');
  assert.equal(jwk.alg, 'RS256');
  assert.equal(jwk.d, undefined, 'private exponent must not be published');
  assert.equal(jwk.kty, 'RSA');
});

test('signIdToken produces a compact JWT that verifies against the published JWKS key', async () => {
  await initOidcKeys();
  const now = Math.floor(Date.now() / 1000);
  const token = await signIdToken({
    iss: getOidcIssuer(),
    sub: 'user-1',
    aud: 'cl_test',
    iat: now,
    exp: now + 900,
  });

  const parts = token.split('.');
  assert.equal(parts.length, 3, 'compact JWT has three segments');

  const jwk = getJwksDocument().keys[0] as crypto.JsonWebKey;
  const pubKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const [h, p, s] = parts;
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${h}.${p}`);
  const sig = Buffer.from(s as string, 'base64url');
  assert.equal(verifier.verify(pubKey, sig), true);

  const header = JSON.parse(Buffer.from(h as string, 'base64url').toString('utf8'));
  assert.equal(header.alg, 'RS256');
  assert.equal(header.typ, 'JWT');
  assert.ok(header.kid);
});
