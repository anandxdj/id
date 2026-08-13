import bcrypt from 'bcryptjs';
import { CRYPTO } from '../constants/index.constants';
import { PasswordService } from '../../modules/auth/password.service';

/**
 * Shared fixture helpers for the integration suites.
 *
 * `passwordHash` exists because the user model is now pure schema: it no longer hashes on
 * save, so a fixture written as `User.create({ password: 'plaintext' })` stores a plaintext
 * string that no login will ever match. Routing every fixture through one helper means the
 * suites cannot drift back into that, and it keeps the hashing policy in one place for tests
 * exactly as it is for production code.
 */
export const TestFixtures = {
  /** An Argon2id digest at the configured cost — what a real account carries. */
  passwordHash(plaintext: string): Promise<string> {
    return PasswordService.hash(plaintext);
  },

  /**
   * A **legacy bcrypt** digest, for the tests that prove the verify-only fallback still
   * works and that a successful login upgrades the stored hash in place. This is the only
   * place bcrypt hashing survives: production writes Argon2id exclusively.
   */
  legacyBcryptHash(plaintext: string): Promise<string> {
    return bcrypt.hash(plaintext, CRYPTO.LEGACY_BCRYPT_ROUNDS);
  },
};
