import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { createApp } from './app';

let server: Server;
let base: string;

before(async () => {
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      base = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(() => {
  server?.close();
});

test('GET /health returns 200 with status ok', async () => {
  const res = await fetch(`${base}/health`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as { status: string; database: string };
  assert.equal(body.status, 'ok');
  // No DB connected in the test process — reports disconnected, does not crash.
  assert.equal(body.database, 'disconnected');
});

test('unknown route returns 404 via ApiError + errorHandler', async () => {
  const res = await fetch(`${base}/no-such-route`);
  assert.equal(res.status, 404);
  const body = (await res.json()) as { success: boolean; message: string };
  assert.equal(body.success, false);
  assert.match(body.message, /not found/i);
});
