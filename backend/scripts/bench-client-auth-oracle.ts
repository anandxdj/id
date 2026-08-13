/**
 * Throwaway measurement: how much a *wrong* client secret costs end to end, depending on
 * whether the client exists and how its secret is stored.
 *
 * The point is the gap between "unknown client_id" and "known client_id, wrong secret".
 * `ClientAuthService` returns an identical `invalid_client` for both, but an unknown id
 * short-circuits before verification while a known one runs it — so whatever verification
 * costs is directly observable as a client-existence oracle.
 *
 * Run: MONGO_URI="mongodb://127.0.0.1:27018/?replicaSet=rs0" \
 *      REDIS_URL="redis://127.0.0.1:6380/5" MONGO_DB_NAME="id_test_m4_bench" \
 *      node --import tsx scripts/bench-client-auth-oracle.ts
 */
import bcrypt from 'bcryptjs';
import { performance } from 'node:perf_hooks';
import { OidcHarness } from '../src/common/testing/oidcHarness';
import { ClientSecretUtil } from '../src/common/utils/clientSecret.utils';
import { CRYPTO } from '../src/common/constants/index.constants';

process.env.OIDC_ISSUER ??= 'http://localhost:4000';
process.env.JWT_ACCESS_SECRET ??= 'bench-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'bench-refresh-secret';

const EMAIL = 'bench-oracle@tabbio.com';
const RUNS = 12;

const median = (samples: number[]): number => {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};

const main = async () => {
  const ctx = await OidcHarness.start({ email: EMAIL, password: 'sup3r-secret-pw' });
  const clientService = await import('../src/modules/oauth-client/oauth-client.service');
  const { OAuthClient } = await import('../src/modules/oauth-client/oauth-client.model');

  const client = await clientService.create({
    clientName: 'Oracle Bench',
    redirectUris: ['http://localhost:3001/cb'],
  });

  const probe = async (clientId: string): Promise<number> => {
    const t0 = performance.now();
    await fetch(`${ctx.base}/oauth/introspect`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: 'definitely-the-wrong-secret',
        token: 'x',
      }),
    });
    return performance.now() - t0;
  };

  const sample = async (label: string, clientId: string): Promise<number> => {
    await probe(clientId);
    const samples: number[] = [];
    for (let i = 0; i < RUNS; i += 1) samples.push(await probe(clientId));
    const m = median(samples);
    console.log(`${label.padEnd(46)} median ${m.toFixed(2).padStart(8)} ms`);
    return m;
  };

  console.log('\n— stored as bcrypt (the old behaviour) —');
  await OAuthClient.updateOne(
    { clientId: client.clientId },
    { $set: { clientSecretHash: await bcrypt.hash(client.clientSecret!, CRYPTO.LEGACY_BCRYPT_ROUNDS) } },
  );
  const bcryptKnown = await sample('known client_id, wrong secret', client.clientId);
  const bcryptUnknown = await sample('unknown client_id', 'cl_nope_not_registered');
  console.log(`oracle signal: ${(bcryptKnown - bcryptUnknown).toFixed(2)} ms`);

  console.log('\n— stored as a SHA-256 digest (the new behaviour) —');
  await OAuthClient.updateOne(
    { clientId: client.clientId },
    { $set: { clientSecretHash: ClientSecretUtil.digest(client.clientSecret!) } },
  );
  const digestKnown = await sample('known client_id, wrong secret', client.clientId);
  const digestUnknown = await sample('unknown client_id', 'cl_nope_not_registered');
  console.log(`oracle signal: ${(digestKnown - digestUnknown).toFixed(2)} ms\n`);

  await OidcHarness.stop(ctx, { email: EMAIL, clientIds: [client.clientId] });
};

void main();
