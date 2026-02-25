import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const SRC_DIR = new URL('../src/', import.meta.url);

const WRITE_ROUTE_RE = /app\.(post|put|delete)\('([^']+)'/g;
const EXEMPT_ROUTES = new Set([
  '/api/v1/auth/login',
]);

const listSourceFiles = async () => {
  const entries = await readdir(SRC_DIR, { withFileTypes: true });
  return entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.js'))
    .map(entry => entry.name);
};

test('all write endpoints are protected by requirePolicyActor (except explicit exemptions)', async () => {
  const files = await listSourceFiles();
  const missingProtection = [];

  for (const fileName of files) {
    const filePath = new URL(fileName, SRC_DIR);
    const source = await readFile(filePath, 'utf8');

    for (const match of source.matchAll(WRITE_ROUTE_RE)) {
      const method = String(match[1] || '').toUpperCase();
      const route = match[2];
      if (EXEMPT_ROUTES.has(route)) continue;

      const start = match.index ?? 0;
      const window = source.slice(start, Math.min(source.length, start + 1400));
      if (!window.includes('requirePolicyActor(')) {
        missingProtection.push(`${fileName}:${method} ${route}`);
      }
    }
  }

  assert.deepEqual(
    missingProtection,
    [],
    `Write endpoints without requirePolicyActor found:\n${missingProtection.join('\n')}`
  );
});


test('policy matrix has expected domain keys for write modules', async () => {
  const policyPath = new URL('../src/policy.js', import.meta.url);
  const source = await readFile(policyPath, 'utf8');

  for (const domain of [
    'workflow',
    'projectInit',
    'composition',
    'registry',
    'integration',
    'projectExtended',
    'versioning',
  ]) {
    assert.match(source, new RegExp(`\\b${domain}\\s*:`), `Missing policy domain: ${domain}`);
  }
});
