import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Config } from '../../../common/config/config';
import { googleConnector } from './google.connector';
import { githubConnector } from './github.connector';
import { listEnabled } from './registry';

/**
 * Connector credentials now come from the frozen config rather than `process.env`, and
 * that object is memoised. Mutating the environment mid-test therefore requires an
 * explicit reload — the same escape hatch is not available to production code, which is
 * the point.
 */
const setEnv = (values: Record<string, string | undefined>): void => {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  Config.reload();
};

beforeEach(() => {
  setEnv({
    GOOGLE_CLIENT_ID: undefined,
    GOOGLE_CLIENT_SECRET: undefined,
    GITHUB_CLIENT_ID: undefined,
    GITHUB_CLIENT_SECRET: undefined,
    AUTH_CONNECTORS: undefined,
  });
});

test('registry enables only connectors whose credentials are present', () => {
  assert.deepEqual(listEnabled().map((c) => c.provider), []);

  setEnv({ GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 'gsec' });
  assert.deepEqual(listEnabled().map((c) => c.provider), ['google']);

  setEnv({ GITHUB_CLIENT_ID: 'hid', GITHUB_CLIENT_SECRET: 'hsec' });
  assert.deepEqual(listEnabled().map((c) => c.provider).sort(), ['github', 'google']);
});

test('AUTH_CONNECTORS allowlist narrows even when more are configured', () => {
  setEnv({
    GOOGLE_CLIENT_ID: 'gid',
    GOOGLE_CLIENT_SECRET: 'gsec',
    GITHUB_CLIENT_ID: 'hid',
    GITHUB_CLIENT_SECRET: 'hsec',
    AUTH_CONNECTORS: 'github',
  });
  assert.deepEqual(listEnabled().map((c) => c.provider), ['github']);
});

test('google authorize URL carries the required OAuth params', () => {
  setEnv({ GOOGLE_CLIENT_ID: 'gid' });
  const url = new URL(googleConnector.buildAuthorizeUrl('st8', 'http://localhost:4000/api/auth/oauth/google/callback'));
  assert.equal(url.origin + url.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  assert.equal(url.searchParams.get('client_id'), 'gid');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('state'), 'st8');
  assert.equal(url.searchParams.get('redirect_uri'), 'http://localhost:4000/api/auth/oauth/google/callback');
  assert.match(url.searchParams.get('scope') ?? '', /openid/);
});

test('github authorize URL carries the required OAuth params', () => {
  setEnv({ GITHUB_CLIENT_ID: 'hid' });
  const url = new URL(githubConnector.buildAuthorizeUrl('st9', 'http://localhost:4000/api/auth/oauth/github/callback'));
  assert.equal(url.origin + url.pathname, 'https://github.com/login/oauth/authorize');
  assert.equal(url.searchParams.get('client_id'), 'hid');
  assert.equal(url.searchParams.get('state'), 'st9');
  assert.match(url.searchParams.get('scope') ?? '', /user:email/);
});

test('buildAuthorizeUrl fails loudly when the client id is missing', () => {
  assert.throws(
    () => googleConnector.buildAuthorizeUrl('st', 'http://localhost:4000/cb'),
    /GOOGLE_CLIENT_ID is not configured/,
  );
});
