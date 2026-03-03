import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const NODE_BACKEND_SRC = 'apps/backend/src';
const scenarioPath = 'tests/parity/backend-functional-parity.scenarios.json';

function walkFiles(dir, predicate, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, predicate, out);
      continue;
    }
    if (!predicate || predicate(full)) out.push(full);
  }
  return out;
}

function normalizePath(value) {
  return String(value || '')
    .split('?')[0]
    .replace(/:[A-Za-z_][A-Za-z0-9_]*/g, '{}')
    .replace(/\{\{[A-Z0-9_]+\}\}/g, '{}')
    .replace(/\{[^/}]+\}/g, '{}')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '{}')
    .replace(/\/(\d+)(?=\/|$)/g, '/{}')
    .replace(/\/+/g, '/');
}

function extractNodeRoutes() {
  const files = walkFiles(NODE_BACKEND_SRC, (file) => file.endsWith('.js'));
  const routeRegex = /\b(?:fastify|app)\.(get|post|put|patch|delete|options|head)\s*\(\s*['"`]([^'"`]+)['"`]/g;

  const routes = new Set();
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = routeRegex.exec(source)) !== null) {
      routes.add(`${match[1].toUpperCase()} ${normalizePath(match[2])}`);
    }
  }
  return routes;
}

function extractScenarioRoutes() {
  const scenarios = JSON.parse(fs.readFileSync(scenarioPath, 'utf8'));
  const routes = new Set();
  for (const scenario of scenarios.scenarios || []) {
    for (const step of scenario.sequence || []) {
      if (!step?.request?.method || !step?.request?.path) continue;
      routes.add(`${String(step.request.method).toUpperCase()} ${normalizePath(step.request.path)}`);
    }
  }
  return routes;
}

test('parity scenarios cover entire Node route surface', () => {
  const nodeRoutes = extractNodeRoutes();
  const scenarioRoutes = extractScenarioRoutes();

  const missing = [...nodeRoutes].filter((route) => !scenarioRoutes.has(route)).sort();

  assert.deepEqual(missing, [], `Missing route coverage in parity scenarios:\n${missing.join('\n')}`);
});