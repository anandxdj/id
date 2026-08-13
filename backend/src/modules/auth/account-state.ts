import { ApiError } from '../../common/utils/ApiError';
import { ERROR_CODES, HTTP_STATUS } from '../../common/constants/index.constants';
import type { IUser } from './auth.model';

/**
 * The account-state gate, checked on **every** path that turns a credential — a password,
 * a verification token, a reset token — into authority.
 *
 * This is a whole module rather than an inline `if` because the reference implementation's
 * §2.3-11 is exactly the bug that inlining produces: it checks suspension on the login
 * path and forgets to on the token-redemption paths, so a suspended user redeems a
 * verification token minted before the suspension and receives a fresh session. A
 * suspension bypass, from one missing conditional on one of four call sites.
 *
 * The answer is deliberately the same for suspended and closed accounts. "This account is
 * suspended" versus "this account was deleted" is a distinction that helps nobody except
 * someone mapping which of a list of addresses is worth attacking.
 */
export const AccountState = {
  /** True when this account may hold a session and spend tokens. */
  isUsable(user: Pick<IUser, 'disabled' | 'deletedAt'>): boolean {
    return user.disabled !== true && !user.deletedAt;
  },

  /**
   * Throw unless the account may proceed.
   *
   * 403 rather than 401: the credential was accepted, the *account* is the problem, and a
   * 401 would invite a client to retry with different credentials forever.
   */
  assertUsable(user: Pick<IUser, 'disabled' | 'deletedAt'>): void {
    if (this.isUsable(user)) return;
    throw ApiError.fromCode(HTTP_STATUS.FORBIDDEN, ERROR_CODES.ACCOUNT_UNAVAILABLE);
  },
};
