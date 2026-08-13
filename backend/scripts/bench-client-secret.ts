/**
 * Throwaway measurement for the client-secret verification change: bcrypt(12) as it was,
 * against SHA-256 + timingSafeEqual as it is. Also measures event-loop blocking, which
 * is the half of the problem a per-call average hides.
 *
 * Run: node --import tsx scripts/bench-client-secret.ts
 */
import bcrypt from 'bcryptjs';
import { performance } from 'node:perf_hooks';
import { ClientSecretUtil } from '../src/common/utils/clientSecret.utils';
import { CRYPTO } from '../src/common/constants/index.constants';

const secret = ClientSecretUtil.generate();

const stats = (samples: number[]) => {
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const at = (quantile: number): number => sorted[Math.floor(sorted.length * quantile)] ?? 0;
  return { mean: sum / sorted.length, p50: at(0.5), p99: at(0.99) };
};

const timeEach = async (label: string, runs: number, fn: () => Promise<unknown>) => {
  await fn();
  const samples: number[] = [];
  for (let i = 0; i < runs; i += 1) {
    const t0 = performance.now();
    await fn();
    samples.push(performance.now() - t0);
  }
  const s = stats(samples);
  console.log(
    `${label.padEnd(34)} mean ${s.mean.toFixed(4).padStart(9)} ms` +
      `   p50 ${s.p50.toFixed(4).padStart(9)} ms   p99 ${s.p99.toFixed(4).padStart(9)} ms`,
  );
  return s.mean;
};

/**
 * Event-loop lag under load: a timer asks to fire every 5 ms while verifications run.
 * How late it actually fires is how long other requests were stalled behind this work.
 */
const measureLag = async (label: string, runs: number, fn: () => Promise<unknown>) => {
  const lags: number[] = [];
  let last = performance.now();
  const interval = setInterval(() => {
    const now = performance.now();
    lags.push(now - last - 5);
    last = now;
  }, 5);

  for (let i = 0; i < runs; i += 1) await fn();
  clearInterval(interval);

  if (lags.length === 0) {
    console.log(`${label.padEnd(34)} loop lag  no timer ticks — work finished inside 5 ms`);
    return;
  }
  const s = stats(lags);
  console.log(
    `${label.padEnd(34)} loop lag  p50 ${s.p50.toFixed(2)} ms   p99 ${s.p99.toFixed(2)} ms` +
      `   max ${Math.max(...lags).toFixed(2)} ms   (${lags.length} ticks)`,
  );
};

const main = async () => {
  const legacyHash = await bcrypt.hash(secret, CRYPTO.LEGACY_BCRYPT_ROUNDS);
  const digest = ClientSecretUtil.digest(secret);

  console.log(`secret bytes: ${CRYPTO.TOKEN_BYTES.CLIENT_SECRET} (base64url length ${secret.length})\n`);

  const before = await timeEach('BEFORE  bcrypt(12) verify', 50, () =>
    bcrypt.compare(secret, legacyHash),
  );
  const after = await timeEach('AFTER   sha256 + timingSafeEqual', 20_000, () =>
    ClientSecretUtil.verify(digest, secret),
  );
  console.log(`\nspeedup: ${(before / after).toFixed(0)}x   (${before.toFixed(2)} ms -> ${after.toFixed(4)} ms)\n`);

  /*
   * Event-loop lag, measured only for bcrypt. Running the same probe over the fast path
   * measures nothing useful: the SHA-256 branch is entirely synchronous, so awaiting its
   * already-resolved promise in a tight loop drains the microtask queue without ever
   * reaching the timer phase, and the probe reports no ticks at all. The honest figure
   * for the fast path is its synchronous cost per call, printed above, and the derived
   * concurrency below.
   */
  await measureLag('BEFORE  bcrypt(12) x30', 30, () => bcrypt.compare(secret, legacyHash));
  console.log(
    `AFTER   verifications needed to stall the loop as long as one bcrypt call: ` +
      `${Math.round(before / after).toLocaleString()}`,
  );

  // A wrong secret must cost the same as a right one on the fast path.
  await timeEach('AFTER   wrong secret', 20_000, () =>
    ClientSecretUtil.verify(digest, `${secret}x`),
  );
};

void main();
