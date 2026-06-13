import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../src/common/config/db';
import { upsertSeedClient } from '../src/modules/oauth-client/oauth-client.service';
import type { CreateClientInput } from '../src/modules/oauth-client/oauth-client.service';

/**
 * Register the internal relying-party apps. Edit INTERNAL_CLIENTS to match your
 * projects. Each entry uses a fixed clientId so re-running is idempotent; a fresh
 * secret is issued every run and printed once — copy it into the app's config.
 */
const INTERNAL_CLIENTS: Array<{ clientId: string } & CreateClientInput> = [
  {
    clientId: 'cl_example_app',
    clientName: 'Example Internal App',
    redirectUris: ['http://localhost:3001/api/auth/callback/id'],
    description: 'Replace with a real internal project.',
  },
];

async function main() {
  await connectDB();

  console.log('\n=== Seeded OAuth clients (secrets shown ONCE) ===\n');
  for (const { clientId, ...input } of INTERNAL_CLIENTS) {
    const result = await upsertSeedClient(clientId, input);
    console.log(`  ${input.clientName}`);
    console.log(`    client_id:     ${result.clientId}`);
    console.log(`    client_secret: ${result.clientSecret}  (${result.created ? 'created' : 'rotated'})`);
    console.log(`    redirect_uris: ${input.redirectUris.join(', ')}\n`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[seed:clients] Failed:', err);
  process.exit(1);
});
