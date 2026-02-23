import test from 'node:test';
import assert from 'node:assert/strict';
import { createIdempotencyStore } from '../src/idempotency-store.js';

test('idempotency store returns miss/hit/conflict as expected', async () => {
  const store = createIdempotencyStore({ ttlMs: 1_000, maxEntries: 10 });

  assert.deepEqual(store.get('k1', 'fp1'), { status: 'miss' });

  store.set('k1', 'fp1', { ok: true });
  assert.deepEqual(store.get('k1', 'fp1'), { status: 'hit', value: { ok: true } });
  assert.deepEqual(store.get('k1', 'fp2'), { status: 'conflict' });
});

test('idempotency store expires values by ttl', async () => {
  const store = createIdempotencyStore({ ttlMs: 20, maxEntries: 10 });
  store.set('k2', 'fp1', { ok: true });
  assert.equal(store.get('k2', 'fp1').status, 'hit');

  await new Promise(resolve => setTimeout(resolve, 30));
  assert.deepEqual(store.get('k2', 'fp1'), { status: 'miss' });
});
