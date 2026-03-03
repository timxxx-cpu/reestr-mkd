import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const scenariosFile = 'tests/parity/backend-functional-parity.scenarios.json';
const payload = JSON.parse(readFileSync(scenariosFile, 'utf8'));

const requiredScenarioNames = [
  'project-list-filters',
  'locks-race-cases',
  'registry-upsert-idempotency',
  'auth-policy-negative',
  'workflow-decline-chain',
  'versioning-flow',
];

test('parity scenarios include mandatory coverage packs', () => {
  const names = new Set((payload.scenarios || []).map(s => s?.name).filter(Boolean));
  for (const required of requiredScenarioNames) {
    assert.equal(names.has(required), true, `Missing required scenario pack: ${required}`);
  }
});

test('each mandatory scenario has non-empty sequence', () => {
  const byName = new Map((payload.scenarios || []).map(s => [s.name, s]));
  for (const required of requiredScenarioNames) {
    const scenario = byName.get(required);
    assert.ok(scenario, `Scenario not found: ${required}`);
    assert.ok(Array.isArray(scenario.sequence) && scenario.sequence.length > 0, `Scenario ${required} must have a non-empty sequence`);
  }
});
