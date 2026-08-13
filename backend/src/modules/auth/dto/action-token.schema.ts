import { z } from 'zod';
import { CRYPTO, FIELD_LIMITS } from '../../../common/constants/index.constants';

/**
 * DTOs for the mailbox-authenticated flows.
 *
 * The token arrives in the **body**, never a query string or a path parameter. A token in a
 * URL is copied into `Referer` headers, browser history, and every access log between the
 * client and us — which is how the reference implementation's verification and reset tokens
 * end up in logs (§2.3-14). The frontend reads the token out of the link fragment and
 * POSTs it.
 */

/**
 * A base64url token of `CRYPTO.TOKEN_BYTES.ACTION_TOKEN` bytes. Bounded on both ends so a
 * megabyte of junk is rejected by the validator rather than hashed and looked up.
 */
const actionToken = z
  .string()
  .trim()
  .min(1)
  .max(Math.ceil((CRYPTO.TOKEN_BYTES.ACTION_TOKEN * 8) / 6) + 8);

const email = z.string().trim().toLowerCase().email().max(FIELD_LIMITS.EMAIL);

export const verifyEmailSchema = z.object({ token: actionToken });
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

/** Shared by resend-verification and forgot-password: an address and nothing else. */
export const emailOnlySchema = z.object({ email });
export type EmailOnlyInput = z.infer<typeof emailOnlySchema>;

export const resetPasswordSchema = z.object({
  token: actionToken,
  password: z.string().min(FIELD_LIMITS.PASSWORD_MIN).max(FIELD_LIMITS.PASSWORD_MAX),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
