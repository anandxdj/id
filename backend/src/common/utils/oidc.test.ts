/**
 * PKCE and token-hashing primitives.
 *
 * The signing-key tests that used to live here moved to
 * `modules/oauth/signing-key.integration.test.ts` alongside the keyring itself, which
 * is a Mongo-backed collection since M4 rather than a single PEM loaded at boot.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pkceChallengeS256, verifyPkce, hashToken, randomBase64Url } from './crypto.utils';

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

