import { test, before } from 'node:test';
import assert from 'node:assert/strict';

before(() => {
  process.env.JWT_ACCESS_SECRET = 'test-access-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
});

test('access token round-trips id/sid/role', async () => {
  const { generateAccessToken, verifyAccessToken } = await import('./jwt.utils');
  const token = generateAccessToken({ id: 'u1', sid: 's1', role: 'admin' });
  const decoded = verifyAccessToken(token);
  assert.equal(decoded.id, 'u1');
  assert.equal(decoded.sid, 's1');
  assert.equal(decoded.role, 'admin');
});

test('refresh token verifies with the refresh secret, not the access secret', async () => {
  const { generateRefreshToken, verifyRefreshToken, verifyAccessToken } = await import('./jwt.utils');
  const token = generateRefreshToken({ id: 'u1', sid: 's1' });
  assert.equal(verifyRefreshToken(token).id, 'u1');
  assert.throws(() => verifyAccessToken(token), 'access secret must reject a refresh token');
});

test('a tampered token fails verification', async () => {
  const { generateAccessToken, verifyAccessToken } = await import('./jwt.utils');
  const token = generateAccessToken({ id: 'u1', sid: 's1', role: 'user' });
  const tampered = `${token}x`;
  assert.throws(() => verifyAccessToken(tampered));
});
