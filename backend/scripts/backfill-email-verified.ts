import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../src/common/config/db';
import { EMAIL_VERIFICATION_GATE } from '../src/common/constants/index.constants';
import User from '../src/modules/auth/auth.model';

/**
 * Mark every **pre-existing** account as email-verified, so that gating login on
 * verification does not lock out the entire user base.
 *
 * Why this exists: M2 shipped the verification flow but deliberately did not gate login
 * on it, because every account predating that flow carries `isVerified: false` and
 * turning the gate on would have signed out everyone at once. The decision was backfill,
 * then gate — and this is the backfill. **It must run before the gate is deployed.**
 *
 * "Idempotent" here means something stronger than "safe to run twice this afternoon".
 * The naive version — `updateMany({ isVerified: false }, …)` — is safe to re-run only for
 * as long as nobody registers in between; run it again next month and it silently
 * verifies every account created since, which is exactly the population the gate exists
 * to cover. So the filter is pinned to a fixed cutoff
 * (`EMAIL_VERIFICATION_GATE.BACKFILL_CUTOFF_ISO`): the script targets the same set of
 * documents on the first run and on the hundredth, and accounts created after the cutoff
 * are never touched however often it runs.
 *
 * Closed accounts (`deletedAt` set) are skipped. Their tombstoned address is not one
 * anybody proved control of, and flipping a flag on a row nothing will ever authenticate
 * against is noise in the diff.
 *
 *   pnpm exec tsx scripts/backfill-email-verified.ts
 */
async function main() {
  const cutoff = new Date(EMAIL_VERIFICATION_GATE.BACKFILL_CUTOFF_ISO);
  if (Number.isNaN(cutoff.getTime())) {
    throw new Error(
      `EMAIL_VERIFICATION_GATE.BACKFILL_CUTOFF_ISO is not a valid date: ${EMAIL_VERIFICATION_GATE.BACKFILL_CUTOFF_ISO}`,
    );
  }

  await connectDB();

  const filter = {
    isVerified: false,
    deletedAt: null,
    createdAt: { $lt: cutoff },
  };

  const pending = await User.countDocuments(filter);
  if (pending === 0) {
    console.log(
      `[backfill:verified] Nothing to do — no live unverified account predates ${cutoff.toISOString()}`,
    );
    await mongoose.disconnect();
    return;
  }

  const result = await User.updateMany(filter, { $set: { isVerified: true } });
  console.log(
    `[backfill:verified] Verified ${result.modifiedCount} of ${pending} accounts created before ${cutoff.toISOString()}`,
  );

  // Re-running now is a no-op by construction; say so rather than leaving the operator to
  // wonder whether a second run would undo something.
  const remaining = await User.countDocuments(filter);
  console.log(`[backfill:verified] Remaining in scope after the run: ${remaining} (expected 0)`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[backfill:verified] Failed:', err);
  process.exit(1);
});
