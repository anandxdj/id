import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { googleConnector } from './google.connector';
import { githubConnector } from './github.connector';
import { listEnabled } from './registry';

beforeEach(() => {
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.GITHUB_CLIENT_ID;
  delete process.env.GITHUB_CLIENT_SECRET;
  delete process.env.AUTH_CONNECTORS;
});

test('registry enables only connectors whose credentials are present', () => {
  assert.deepEqual(listEnabled().map((c) => c.provider), []);

  process.env.GOOGLE_CLIENT_ID = 'gid';
  process.env.GOOGLE_CLIENT_SECRET = 'gsec';
  assert.deepEqual(listEnabled().map((c) => c.provider), ['google']);

  process.env.GITHUB_CLIENT_ID = 'hid';
  process.env.GITHUB_CLIENT_SECRET = 'hsec';
  assert.deepEqual(listEnabled().map((c) => c.provider).sort(), ['github', 'google']);
});

test('AUTH_CONNECTORS allowlist narrows even when more are configured', () => {
  process.env.GOOGLE_CLIENT_ID = 'gid';
  process.env.GOOGLE_CLIENT_SECRET = 'gsec';
  process.env.GITHUB_CLIENT_ID = 'hid';
  process.env.GITHUB_CLIENT_SECRET = 'hsec';
  process.env.AUTH_CONNECTORS = 'github';
  assert.deepEqual(listEnabled().map((c) => c.provider), ['github']);
});

test('google authorize URL carries the required OAuth params', () => {
  process.env.GOOGLE_CLIENT_ID = 'gid';
  const url = new URL(googleConnector.buildAuthorizeUrl('st8', 'http://localhost:4000/api/auth/oauth/google/callback'));
  assert.equal(url.origin + url.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  assert.equal(url.searchParams.get('client_id'), 'gid');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('state'), 'st8');
  assert.equal(url.searchParams.get('redirect_uri'), 'http://localhost:4000/api/auth/oauth/google/callback');
  assert.match(url.searchParams.get('scope') ?? '', /openid/);
});

test('github authorize URL carries the required OAuth params', () => {
  process.env.GITHUB_CLIENT_ID = 'hid';
  const url = new URL(githubConnector.buildAuthorizeUrl('st9', 'http://localhost:4000/api/auth/oauth/github/callback'));
  assert.equal(url.origin + url.pathname, 'https://github.com/login/oauth/authorize');
  assert.equal(url.searchParams.get('client_id'), 'hid');
  assert.equal(url.searchParams.get('state'), 'st9');
  assert.match(url.searchParams.get('scope') ?? '', /user:email/);
});
