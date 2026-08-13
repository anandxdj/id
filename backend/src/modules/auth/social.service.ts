import { ApiError } from '../../common/utils/ApiError';
import { randomBase64Url } from '../../common/utils/crypto.utils';
import { CRYPTO } from '../../common/constants/index.constants';
import User from './auth.model';
import type { IUser } from './auth.model';
import Identity from './identity.model';
import type { NormalizedProfile } from './connectors/types';
import { OAuthStateStore } from './oauth-state.store';

interface OAuthStatePayload {
  provider: string;
  returnTo?: string;
}

/** Persist a one-time CSRF state mapped to the provider + post-login return target. */
export const saveOAuthState = async (provider: string, returnTo?: string): Promise<string> => {
  const state = randomBase64Url(CRYPTO.TOKEN_BYTES.STATE);
  // Calls out to the state store, which persists only a hash of the state.
  await OAuthStateStore.create({ state, provider, returnTo });
  return state;
};

/** Validate and consume a state (single use, atomic). Returns null if unusable. */
export const consumeOAuthState = async (
  state: string | undefined,
): Promise<OAuthStatePayload | null> => {
  if (!state) return null;
  const claimed = await OAuthStateStore.consume(state);
  if (!claimed) return null;
  return { provider: claimed.provider, returnTo: claimed.returnTo };
};

/**
 * Resolve a connector profile to a canonical User, creating/linking as needed:
 *  1. Known identity → its user.
 *  2. Verified email matching an existing user → link a new identity to that user.
 *  3. Otherwise → create a new user + identity.
 * Linking by email happens ONLY when the provider asserts the email is verified.
 */
export const findOrCreateFromProfile = async (profile: NormalizedProfile): Promise<IUser> => {
  const existingIdentity = await Identity.findOne({
    provider: profile.provider,
    providerAccountId: profile.providerAccountId,
  });
  if (existingIdentity) {
    const user = await User.findById(existingIdentity.userId);
    if (user) return user;
    // Orphaned identity (user deleted) — drop it and fall through to recreate.
    await Identity.deleteOne({ _id: existingIdentity._id });
  }

  const email = profile.email?.toLowerCase().trim();
  if (!email) {
    throw ApiError.badRequest(`${profile.provider} did not return an email address`);
  }

  const linkIdentity = async (userId: IUser['_id']) => {
    await Identity.create({
      userId,
      provider: profile.provider,
      providerAccountId: profile.providerAccountId,
      email,
      name: profile.name,
      picture: profile.picture,
    });
  };

  if (profile.emailVerified) {
    const byEmail = await User.findOne({ email });
    if (byEmail) {
      await linkIdentity(byEmail._id);
      if (!byEmail.isVerified) {
        byEmail.isVerified = true;
        await byEmail.save();
      }
      return byEmail;
    }
  }

  const user = await User.create({
    name: profile.name || email,
    email,
    isVerified: profile.emailVerified,
    profilePictureUrl: profile.picture || '',
  });
  await linkIdentity(user._id);
  return user;
};
