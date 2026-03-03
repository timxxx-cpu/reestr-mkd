import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const SCRIPT = path.resolve('scripts/summarize-backend-jpa-parity-report.mjs');

function runSummary(report) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'parity-summary-'));
  const reportPath = path.join(dir, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  const result = spawnSync(process.execPath, [SCRIPT, reportPath], {
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  return result.stdout;
}

test('summarizer prints root-cause bucket with hint and examples', () => {
  const output = runSummary({
    generatedAt: '2026-03-03T06:11:42.903Z',
    totals: { scenarios: 1, steps: 1, failures: 1 },
    mismatches: [
      {
        scenario: 'locks-race-cases',
        step: 'lock-release',
        status: { node: 400, java: 200, same: false },
        body: {
          same: false,
          node: { code: 'FST_ERR_CTP_EMPTY_JSON_BODY' },
          java: { ok: true, reason: 'OK' },
        },
      },
    ],
  });

  assert.match(output, /Probable root causes:/);
  assert.match(output, /empty-json-body-contract-drift: 1 \| Node rejects empty JSON body while Java accepts same request\./);
  assert.match(output, /examples: locks-race-cases \/ lock-release/);
});

test('summarizer detects snapshot serialization drift', () => {
  const output = runSummary({
    generatedAt: '2026-03-03T06:11:42.903Z',
    totals: { scenarios: 1, steps: 1, failures: 1 },
    mismatches: [
      {
        scenario: 'versioning-flow',
        step: 'version-approve',
        status: { node: 200, java: 200, same: true },
        body: {
          same: false,
          node: { snapshot_data: { v: 1, parity: true } },
          java: { snapshot_data: '{"v": 1, "parity": true}' },
        },
      },
    ],
  });

  assert.match(output, /snapshot-json-serialization-drift: 1/);
});