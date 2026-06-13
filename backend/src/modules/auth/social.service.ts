import { ApiError } from '../../common/utils/ApiError';
import { redis } from '../../common/config/redis';
import { randomBase64Url } from '../../common/utils/crypto.utils';
import User from './auth.model';
import type { IUser } from './auth.model';
import Identity from './identity.model';
import type { NormalizedProfile } from './connectors/types';

const STATE_TTL_SECONDS = 600; // 10 min to complete the round-trip

interface OAuthState {
  provider: string;
  returnTo?: string;
}

/** Persist a one-time CSRF state mapped to the provider + post-login return target. */
export const saveOAuthState = async (provider: string, returnTo?: string): Promise<string> => {
  const state = randomBase64Url(24);
  const payload: OAuthState = { provider, returnTo };
  await redis.set(`oauth_state:${state}`, JSON.stringify(payload), 'EX', STATE_TTL_SECONDS);
  return state;
};

/** Validate and consume a state (single use). Returns null if missing/expired. */
export const consumeOAuthState = async (state: string | undefined): Promise<OAuthState | null> => {
  if (!state) return null;
  const key = `oauth_state:${state}`;
  const json = await redis.get(key);
  if (!json) return null;
  await redis.del(key);
  return JSON.parse(json) as OAuthState;
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
