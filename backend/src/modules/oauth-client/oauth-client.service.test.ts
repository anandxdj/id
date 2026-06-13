import { test } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { verifyClientSecret } from './oauth-client.service';

test('verifyClientSecret: true for correct secret, false for wrong', async () => {
  const secret = 'super-secret-value';
  const clientSecretHash = await bcrypt.hash(secret, 12);
  assert.equal(await verifyClientSecret({ clientSecretHash }, secret), true);
  assert.equal(await verifyClientSecret({ clientSecretHash }, 'nope'), false);
});

test('verifyClientSecret: false when client is null or hash is absent', async () => {
  assert.equal(await verifyClientSecret(null, 'x'), false);
  assert.equal(await verifyClientSecret({}, 'x'), false);
});
