import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';

// lazyConnect: no socket is opened at import time — only on the first command
// (index.ts calls redis.ping() at startup). This keeps tests that never touch
// Redis from holding the event loop open.
export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
});

redis.on('error', (err) => console.error('[Redis] Error:', err));
redis.on('connect', () => console.log('[Redis] Connected'));
