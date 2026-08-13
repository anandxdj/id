import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../src/common/config/db';
import { Config } from '../src/common/config/config';
import { USER_ROLES } from '../src/common/constants/index.constants';
import User from '../src/modules/auth/auth.model';
import { PasswordService } from '../src/modules/auth/password.service';

const DEFAULT_ADMIN_NAME = 'Admin';

/**
 * Provision the internal admin account from SEED_ADMIN_* env vars. Idempotent:
 * re-running does not duplicate the user and does not overwrite an existing password.
 */
async function main() {
  const { adminEmail, adminName, adminPassword } = Config.seed;

  if (!adminEmail || !adminPassword) {
    throw new Error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in .env');
  }

  const email = adminEmail.toLowerCase().trim();
  const name = adminName || DEFAULT_ADMIN_NAME;
  const password = adminPassword;

  await connectDB();

  const existing = await User.findOne({ email });
  if (existing) {
    existing.role = USER_ROLES.ADMIN;
    existing.isVerified = true;
    if (existing.name === DEFAULT_ADMIN_NAME || !existing.name) existing.name = name;
    await existing.save();
    console.log(`[seed:admin] Updated existing admin: ${email}`);
  } else {
    // The model no longer hashes on save (it is pure schema now), so the digest is produced
    // here, by the one service that owns hashing policy.
    await User.create({
      name,
      email,
      password: await PasswordService.hash(password),
      role: USER_ROLES.ADMIN,
      isVerified: true,
    });
    console.log(`[seed:admin] Created admin: ${email}`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[seed:admin] Failed:', err);
  process.exit(1);
});
