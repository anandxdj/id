import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../src/common/config/db';
import User from '../src/modules/auth/auth.model';

/**
 * Provision the internal admin account from SEED_ADMIN_* env vars. Idempotent:
 * re-running does not duplicate the user and does not overwrite an existing password.
 */
async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL || '').toLowerCase().trim();
  const name = process.env.SEED_ADMIN_NAME || 'Admin';
  const password = process.env.SEED_ADMIN_PASSWORD || '';

  if (!email || !password) {
    throw new Error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in .env');
  }

  await connectDB();

  const existing = await User.findOne({ email });
  if (existing) {
    existing.role = 'admin';
    existing.isVerified = true;
    if (existing.name === 'Admin' || !existing.name) existing.name = name;
    await existing.save();
    console.log(`[seed:admin] Updated existing admin: ${email}`);
  } else {
    await User.create({ name, email, password, role: 'admin', isVerified: true });
    console.log(`[seed:admin] Created admin: ${email}`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[seed:admin] Failed:', err);
  process.exit(1);
});
