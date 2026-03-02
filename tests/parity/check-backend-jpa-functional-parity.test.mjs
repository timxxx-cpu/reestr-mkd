import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const scriptPath = path.resolve('scripts/check-backend-jpa-functional-parity.mjs');

function startServer(handler) {
  const server = http.createServer(handler);
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${addr.port}`,
      });
    });
  });
}

function runChecker(env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath], { env: { ...process.env, ...env } });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

test('functional parity checker passes for equal responses', async () => {
  const scenarioFile = path.resolve('tests/parity/.tmp-scenario-ok.json');
  await fs.writeFile(
    scenarioFile,
    JSON.stringify({
      scenarios: [
        {
          name: 'equal',
          sequence: [{ name: 'ping', request: { method: 'GET', path: '/ping' } }],
        },
      ],
    })
  );

  const handler = (_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  };

  const left = await startServer(handler);
  const right = await startServer(handler);

  try {
    const result = await runChecker({
      NODE_BACKEND_URL: left.baseUrl,
      JAVA_JPA_BACKEND_URL: right.baseUrl,
      PARITY_SCENARIOS: scenarioFile,
    });
    assert.equal(result.code, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Functional parity check passed/);
  } finally {
    left.server.close();
    right.server.close();
    await fs.rm(scenarioFile, { force: true });
  }
});

test('functional parity checker fails for mismatched response', async () => {
  const scenarioFile = path.resolve('tests/parity/.tmp-scenario-fail.json');
  await fs.writeFile(
    scenarioFile,
    JSON.stringify({
      scenarios: [
        {
          name: 'diff',
          sequence: [{ name: 'status', request: { method: 'GET', path: '/status' } }],
        },
      ],
    })
  );

  const left = await startServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  });
  const right = await startServer((_req, res) => {
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: false }));
  });

  try {
    const result = await runChecker({
      NODE_BACKEND_URL: left.baseUrl,
      JAVA_JPA_BACKEND_URL: right.baseUrl,
      PARITY_SCENARIOS: scenarioFile,
    });
    assert.equal(result.code, 1, result.stderr || result.stdout);
    assert.match(result.stderr, /Functional parity check failed/);
  } finally {
    left.server.close();
    right.server.close();
    await fs.rm(scenarioFile, { force: true });
  }
});
