import { test } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { verifyClientSecret } from './oauth-client.service';
import { ClientSecretUtil } from '../../common/utils/clientSecret.utils';

test('verifyClientSecret: true for correct secret, false for wrong', async () => {
  const secret = 'super-secret-value';
  const clientSecretHash = ClientSecretUtil.digest(secret);

  assert.deepEqual(await verifyClientSecret({ clientSecretHash }, secret), {
    ok: true,
    needsUpgrade: false,
  });
  assert.equal((await verifyClientSecret({ clientSecretHash }, 'nope')).ok, false);
});

test('verifyClientSecret: a pre-migration bcrypt hash still verifies, and reports the upgrade', async () => {
  const secret = 'super-secret-value';
  const clientSecretHash = await bcrypt.hash(secret, 12);

  assert.deepEqual(await verifyClientSecret({ clientSecretHash }, secret), {
    ok: true,
    needsUpgrade: true,
  });
  assert.deepEqual(await verifyClientSecret({ clientSecretHash }, 'nope'), {
    ok: false,
    needsUpgrade: false,
  });
});

test('verifyClientSecret: false when client is null or hash is absent', async () => {
  assert.equal((await verifyClientSecret(null, 'x')).ok, false);
  assert.equal((await verifyClientSecret({}, 'x')).ok, false);
});
