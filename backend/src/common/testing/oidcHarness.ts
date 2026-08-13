import type { Server } from 'node:http';

/**
 * Shared setup for the OIDC integration suites.
 *
 * Every one of them needs the same six things — a Mongo connection, a Redis ping, the
 * signing keyring, a listening app, a verified user, and that user's session cookie —
 * and getting any of them subtly different between files is how two suites end up
 * disagreeing about what "logged in" means.
 *
 * Every import inside is dynamic. These modules read frozen configuration at first use,
 * so a test file must be able to set `process.env` before anything is loaded; a
 * top-level import here would defeat that for every file that imports the harness.
 */

export interface HarnessOptions {
  /** Distinguishes this suite's fixtures from every other suite's. */
  email: string;
  password: string;
  name?: string;
}

export interface HarnessContext {
  base: string;
  server: Server;
  userId: string;
  /** Raw first-party session JWT — usable as a cookie or a bearer token. */
  sessionToken: string;
  cookie: string;
}

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('probe timeout')), ms)),
  ]);

export const OidcHarness = {
  /**
   * Clear this machine's rate-limit counters.
   *
   * The limiters are shared, cross-process, IP-keyed counters on a 15-minute window,
   * and every integration suite calls from 127.0.0.1 against the same Redis. Without
   * this, a full run consumes a large slice of the `/oauth/token` budget and the *next*
   * run inside the window inherits it — so whether the suite passes depends on how
   * recently it last ran, which is the definition of a flaky test.
   *
   * Only the rate-limit namespace is touched, never the whole keyspace: the instance
   * may be shared with something else, which is exactly why the prefix exists.
   */
  async clearRateLimitCounters(): Promise<void> {
    const { redisCommand } = await import('../config/redis');
    const { REDIS_KEYS } = await import('../constants/index.constants');
    try {
      const keys = (await redisCommand(['KEYS', `${REDIS_KEYS.RATE_LIMIT}*`])) as string[];
      if (Array.isArray(keys) && keys.length > 0) {
        await redisCommand(['DEL', ...keys]);
      }
    } catch {
      // The limiters fail open, so a Redis that cannot be reached here costs nothing.
    }
  },

  /** Connect, seed a verified user, start the app, and sign that user in. */
  async start(options: HarnessOptions): Promise<HarnessContext> {
    const mongoose = (await import('mongoose')).default;
    const { getRedis } = await import('../config/redis');
    const { SigningKeyService } = await import('../../modules/oauth/signing-key.service');

    await withTimeout(
      mongoose.connect(process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017', {
        dbName: process.env.MONGO_DB_NAME,
        serverSelectionTimeoutMS: 1500,
      }),
      2000,
    );
    await withTimeout(getRedis().ping(), 2000);
    await this.clearRateLimitCounters();
    // After the connect: the keyring is a Mongo collection since M4.
    await SigningKeyService.init();

    const { User } = await import('../../modules/auth/auth.model');
    await User.deleteMany({ email: options.email });
    const user = await User.create({
      name: options.name ?? 'OIDC Harness',
      email: options.email,
      password: options.password,
      isVerified: true,
    });

    const { createApp } = await import('../../app');
    const app = createApp();
    const server = await new Promise<Server>((resolve) => {
      const listening = app.listen(0, () => resolve(listening));
    });
    const address = server.address();
    const base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;

    const login = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: options.email, password: options.password }),
    });
    const body = (await login.json()) as { data?: { accessToken?: string } };
    const sessionToken = body.data?.accessToken;
    if (!sessionToken) throw new Error('harness login did not return an access token');

    return {
      base,
      server,
      userId: user._id.toString(),
      sessionToken,
      cookie: `accessToken=${sessionToken}`,
    };
  },

  /** Tear down fixtures created against `email` and close every connection. */
  async stop(context: HarnessContext | undefined, options: { email: string; clientIds: string[] }): Promise<void> {
    context?.server.close();

    const mongoose = (await import('mongoose')).default;
    if (mongoose.connection.readyState !== 1) return;

    const { disconnectRedis } = await import('../config/redis');
    const { User } = await import('../../modules/auth/auth.model');
    const { OAuthClient } = await import('../../modules/oauth-client/oauth-client.model');
    const { Session } = await import('../../modules/auth/session.model');
    const Consent = (await import('../../modules/oauth/consent.model')).default;
    const { OAuthAuthCode } = await import('../../modules/oauth/oauth-auth-code.model');
    const { OAuthAuthRequest } = await import('../../modules/oauth/oauth-auth-request.model');
    const { OAuthAccessToken } = await import('../../modules/oauth/oauth-access-token.model');

    const user = await User.findOne({ email: options.email });
    if (user) {
      await Session.deleteMany({ userId: user._id });
      await OAuthAuthRequest.deleteMany({ userId: user._id });
      await OAuthAuthCode.deleteMany({ userId: user._id });
      await OAuthAccessToken.deleteMany({ userId: user._id });
      await Consent.deleteMany({ userId: user._id });
    }
    await User.deleteMany({ email: options.email });
    if (options.clientIds.length > 0) {
      await OAuthClient.deleteMany({ clientId: { $in: options.clientIds } });
    }

    await mongoose.disconnect();
    await disconnectRedis();
  },

  /** Best-effort teardown for a `before` hook that failed partway through. */
  async abandon(): Promise<void> {
    try {
      const mongoose = (await import('mongoose')).default;
      await mongoose.disconnect();
    } catch {
      /* ignore */
    }
    try {
      const { disconnectRedis } = await import('../config/redis');
      await disconnectRedis();
    } catch {
      /* ignore */
    }
  },
};
