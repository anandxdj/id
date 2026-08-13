import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { createApp } from './app';
import { disconnectRedis } from './common/config/redis';

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

after(async () => {
  server?.close();
  // Every request here passes through the Redis-backed rate limiter, so a client exists
  // even though this suite never touches Redis directly. Left open, its reconnect timer
  // keeps the event loop alive and the run never exits.
  await disconnectRedis();
});

test('GET /health is a pure liveness probe — 200 regardless of downstream state', async () => {
  const res = await fetch(`${base}/health`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as { status: string; uptimeSeconds: number };
  assert.equal(body.status, 'ok');
  assert.equal(typeof body.uptimeSeconds, 'number');
  // Deliberately independent of the database: a brief connection blip must not make the
  // orchestrator restart an otherwise-healthy process.
  assert.equal('database' in body, false);
});

test('GET /ready reports 503 while the database is unreachable', async () => {
  const res = await fetch(`${base}/ready`);
  // No DB connected in this test process, so the instance is not ready for traffic.
  assert.equal(res.status, 503);
  const body = (await res.json()) as { status: string; database: string };
  assert.equal(body.status, 'not_ready');
  assert.equal(body.database, 'disconnected');
});

test('unknown route returns 404 via ApiError + errorHandler', async () => {
  const res = await fetch(`${base}/no-such-route`);
  assert.equal(res.status, 404);
  const body = (await res.json()) as { success: boolean; message: string; code: string };
  assert.equal(body.success, false);
  assert.match(body.message, /not found/i);
  assert.equal(body.code, 'NOT_FOUND');
});

test('a request id is echoed on every response', async () => {
  const res = await fetch(`${base}/health`);
  assert.match(res.headers.get('x-request-id') ?? '', /^[A-Za-z0-9_-]{8,64}$/);
});
