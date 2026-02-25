import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const MAX_ALLOWED_LEGACY_TRACKS = 0;
const ALLOWED_LEGACY_OPERATIONS = new Set([]);

test('legacy cleanup guard: trackLegacyPath operations do not expand unexpectedly', async () => {
  const source = await readFile(new URL('../../../src/lib/api-service.js', import.meta.url), 'utf8');
  const operations = [...source.matchAll(/trackLegacyPath\('([^']+)'\)/g)].map(m => m[1]);

  assert.ok(
    operations.length <= MAX_ALLOWED_LEGACY_TRACKS,
    `Legacy tracks count increased: ${operations.length} > ${MAX_ALLOWED_LEGACY_TRACKS}`
  );

  for (const op of operations) {
    assert.ok(ALLOWED_LEGACY_OPERATIONS.has(op), `Unexpected legacy operation found: ${op}`);
  }
});
