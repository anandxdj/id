/**
 * Scope set arithmetic. Pure functions, no datastore.
 *
 * These are the primitives the escalation fix is built out of, so they get unit
 * coverage of their own rather than only being exercised through an HTTP flow — a
 * subtle bug in `covers` would silently turn every re-prompt into a pass-through.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ScopeUtil } from './scope.util';

test('parse normalises whitespace, duplicates and empties, preserving order', () => {
  assert.deepEqual(ScopeUtil.parse('  openid   email  openid '), ['openid', 'email']);
  assert.deepEqual(ScopeUtil.parse(''), []);
  assert.deepEqual(ScopeUtil.parse(undefined), []);
  assert.deepEqual(ScopeUtil.parse(['openid', 'email', 'email']), ['openid', 'email']);
});

test('intersect keeps only what both sides allow, in the requester order', () => {
  assert.deepEqual(
    ScopeUtil.intersect(['openid', 'profile', 'email'], ['email', 'openid']),
    ['openid', 'email'],
  );
  assert.deepEqual(ScopeUtil.intersect(['profile'], ['openid']), []);
});

test('covers is a superset test, not an existence test', () => {
  // The escalation bug in one assertion: a grant of `openid` does not cover a request
  // for `openid profile`, however much a consent row exists.
  assert.equal(ScopeUtil.covers(['openid'], ['openid', 'profile']), false);
  assert.equal(ScopeUtil.covers(['openid', 'profile'], ['openid']), true);
  assert.equal(ScopeUtil.covers([], ['openid']), false);
  assert.equal(ScopeUtil.covers([], []), true);
});

test('difference reports exactly what a rejection should name', () => {
  assert.deepEqual(
    ScopeUtil.difference(['openid', 'profile', 'admin'], ['openid', 'profile']),
    ['admin'],
  );
  assert.deepEqual(ScopeUtil.difference(['openid'], ['openid']), []);
});

test('union widens a grant without dropping what was already approved', () => {
  assert.deepEqual(ScopeUtil.union(['openid', 'email'], ['openid', 'profile']), [
    'openid',
    'email',
    'profile',
  ]);
});

test('has matches whole scopes, never substrings', () => {
  assert.equal(ScopeUtil.has('openid email', 'email'), true);
  assert.equal(ScopeUtil.has('openid email', 'mail'), false);
  assert.equal(ScopeUtil.has('openid emails', 'email'), false);
  assert.equal(ScopeUtil.has(undefined, 'openid'), false);
});
