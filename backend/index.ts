import 'dotenv/config';
import { createApp } from './src/app';
import { connectDB } from './src/common/config/db';
import { redis } from './src/common/config/redis';
import { initOidcKeys } from './src/common/utils/keys.utils';

async function main() {
  await connectDB();
  await redis.ping();
  console.log('[Redis] Ping OK');

  await initOidcKeys();
  console.log('[OIDC] Signing keys ready');

  const app = createApp();
  const port = process.env.PORT ?? 4000;
  app.listen(port, () => {
    console.log(`[Server] id provider running on :${port} (${process.env.NODE_ENV ?? 'development'})`);
  });
}

main().catch((err) => {
  console.error('[Server] Failed to start:', err);
  process.exit(1);
});
