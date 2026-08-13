/**
 * Per-client protocol policy. Pure functions, no datastore.
 *
 * Two things get unit coverage here that an HTTP flow currently cannot reach:
 *
 *  - **Normalisation of pre-M4 clients.** Mongoose defaults apply to newly created
 *    documents, not to rows already on disk, so every client registered before this
 *    milestone reads back with no `scopes`, `grantTypes`, `responseTypes` or
 *    `tokenEndpointAuthMethod` at all. Getting the fallback wrong either locks all of
 *    them out or waves everything through.
 *
 *  - **Grant- and response-type rejection.** This server implements exactly one of
 *    each, so no client can be *registered* for a value that would fail — and the
 *    discovery document must keep saying so. The enforcement is nonetheless real, and
 *    becomes load-bearing the moment refresh tokens land in M3, so it is exercised
 *    directly rather than left to be discovered by the first client that trips it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ClientPolicy } from './client-policy.service';
import type { IOAuthClient } from '../oauth-client/oauth-client.model';

const clientLike = (overrides: Partial<IOAuthClient> = {}): IOAuthClient =>
  ({
    clientId: 'cl_test',
    redirectUris: ['http://localhost:3001/cb'],
    ...overrides,
  }) as IOAuthClient;

test('a client registered before M4 falls back to the registration defaults', () => {
  const policy = ClientPolicy.effective(clientLike());
  assert.deepEqual(policy.scopes, ['openid', 'profile', 'email']);
  assert.deepEqual(policy.grantTypes, ['authorization_code']);
  assert.deepEqual(policy.responseTypes, ['code']);
  assert.equal(policy.tokenEndpointAuthMethod, 'client_secret_post');
  assert.equal(policy.isPublic, false);
  assert.equal(policy.clientType, 'confidential');
  assert.deepEqual(policy.postLogoutRedirectUris, []);
});

test('a registered policy wins over the defaults', () => {
  const policy = ClientPolicy.effective(
    clientLike({
      scopes: ['openid'],
      tokenEndpointAuthMethod: 'none',
      postLogoutRedirectUris: ['http://localhost:3001/bye'],
    }),
  );
  assert.deepEqual(policy.scopes, ['openid']);
  assert.equal(policy.isPublic, true, 'the `none` auth method is what makes a client public');
  assert.equal(policy.clientType, 'public');
  assert.deepEqual(policy.postLogoutRedirectUris, ['http://localhost:3001/bye']);
});

test('grant and response types are checked against the client, not just the server', () => {
  // A client registered for refresh_token alone must not be able to run the code flow,
  // even though the server implements it.
  const refreshOnly = clientLike({ grantTypes: ['refresh_token'] });
  assert.equal(ClientPolicy.allowsGrantType(refreshOnly, 'authorization_code'), false);
  assert.equal(ClientPolicy.allowsGrantType(refreshOnly, 'refresh_token'), true);

  const codeOnly = clientLike({ responseTypes: ['code'] });
  assert.equal(ClientPolicy.allowsResponseType(codeOnly, 'code'), true);
  assert.equal(ClientPolicy.allowsResponseType(codeOnly, 'token'), false);
  assert.equal(ClientPolicy.allowsResponseType(codeOnly, 'id_token'), false);
});

test('disallowedScopes names every scope outside the allowlist', () => {
  const narrow = clientLike({ scopes: ['openid', 'email'] });
  assert.deepEqual(ClientPolicy.disallowedScopes(narrow, ['openid', 'profile']), ['profile']);
  assert.deepEqual(ClientPolicy.disallowedScopes(narrow, ['openid', 'email']), []);
  assert.deepEqual(ClientPolicy.disallowedScopes(narrow, ['profile', 'admin']), [
    'profile',
    'admin',
  ]);
});

test('redirect URIs match exactly — no prefixes, no wildcards, no trailing-slash mercy', () => {
  const client = clientLike({ redirectUris: ['https://app.example/cb'] });
  assert.equal(ClientPolicy.allowsRedirectUri(client, 'https://app.example/cb'), true);
  assert.equal(ClientPolicy.allowsRedirectUri(client, 'https://app.example/cb/'), false);
  assert.equal(ClientPolicy.allowsRedirectUri(client, 'https://app.example/cb?x=1'), false);
  assert.equal(ClientPolicy.allowsRedirectUri(client, 'https://app.example/cb/../evil'), false);
  assert.equal(ClientPolicy.allowsRedirectUri(client, 'https://app.example.evil/cb'), false);
});

test('post-logout URIs are a separate allowlist from login callbacks', () => {
  // A login callback is not a logout landing page: they are different registrations,
  // and conflating them would let any redirect_uri become a post-logout target.
  const client = clientLike({
    redirectUris: ['https://app.example/cb'],
    postLogoutRedirectUris: ['https://app.example/bye'],
  });
  assert.equal(ClientPolicy.allowsPostLogoutRedirectUri(client, 'https://app.example/bye'), true);
  assert.equal(ClientPolicy.allowsPostLogoutRedirectUri(client, 'https://app.example/cb'), false);
  assert.equal(ClientPolicy.allowsPostLogoutRedirectUri(clientLike(), 'https://app.example/bye'), false);
});
