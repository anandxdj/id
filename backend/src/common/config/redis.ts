import Redis from 'ioredis';
import { Config } from './config';
import { Logger } from '../logger/index.logger';

/**
 * TEMPORARY. Every keyspace this client backs is migrating to a TTL-indexed Mongo
 * collection in M1, after which this file and the `ioredis` dependency are deleted.
 * Do not add new usages.
 *
 * The client itself is created lazily so that importing this module neither reads
 * configuration nor opens a socket — tests that never touch Redis must not be left
 * holding the event loop open.
 */

let client: Redis | undefined;

const create = (): Redis => {
  const instance = new Redis(Config.redis.url, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
  });

  instance.on('error', (error) => Logger.error('Redis error', { error }));
  instance.on('connect', () => Logger.info('Redis connected'));

  return instance;
};

export const getRedis = (): Redis => {
  if (!client) client = create();
  return client;
};

export const disconnectRedis = async (): Promise<void> => {
  if (!client) return;
  await client.quit();
  client = undefined;
  Logger.info('Redis disconnected cleanly');
};

/**
 * Back-compat proxy so existing `redis.get(...)` call sites keep working while M1
 * replaces them one module at a time.
 */
export const redis = new Proxy({} as Redis, {
  get(_target, property, receiver) {
    const instance = getRedis();
    const value = Reflect.get(instance as unknown as object, property, receiver);
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});
