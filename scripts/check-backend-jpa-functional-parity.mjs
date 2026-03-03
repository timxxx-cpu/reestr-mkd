import fs from 'node:fs';
import path from 'node:path';

const nodeBase = process.env.NODE_BACKEND_URL;
const javaBase = process.env.JAVA_JPA_BACKEND_URL;
const scenarioPath = process.env.PARITY_SCENARIOS || 'tests/parity/backend-functional-parity.scenarios.json';
const reportPath = process.env.PARITY_REPORT_PATH || 'tests/parity/.last-functional-parity-report.json';

if (!fs.existsSync(scenarioPath)) {
  console.error(`Scenario file not found: ${scenarioPath}`);
  process.exit(2);
}

if (!nodeBase || !javaBase) {
  console.error('NODE_BACKEND_URL and JAVA_JPA_BACKEND_URL are required');
  process.exit(2);
}

const scenarios = JSON.parse(fs.readFileSync(scenarioPath, 'utf8'));
const context = { ...(scenarios.variables || {}) };
const defaultIgnorePaths = (process.env.PARITY_IGNORE_PATHS || 'requestId,timestamp').split(',').map(v => v.trim()).filter(Boolean);
const artifactsDir = process.env.PARITY_ARTIFACTS_DIR || 'artifacts/backend-jpa-parity';

function fillTemplate(value) {
  if (typeof value === 'string') {
    return value.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key) => String(context[key] ?? ''));
  }
  if (Array.isArray(value)) return value.map(fillTemplate);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fillTemplate(v)]));
  }
  return value;
}

function getByPath(obj, pathExpr) {
  return pathExpr.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function deleteByPath(obj, pathExpr) {
  const parts = pathExpr.split('.').filter(Boolean);

  function walk(cursor, idx) {
    if (cursor == null || typeof cursor !== 'object') return;
    if (idx >= parts.length) return;

    const key = parts[idx];
    const isLeaf = idx === parts.length - 1;

    if (key === '*') {
      if (Array.isArray(cursor)) {
        for (const item of cursor) walk(item, idx + 1);
      } else {
        for (const nested of Object.values(cursor)) walk(nested, idx + 1);
      }
      return;
    }

    if (isLeaf) {
      if (key in cursor) delete cursor[key];
      return;
    }

    walk(cursor[key], idx + 1);
  }

  walk(obj, 0);
}

function coerceJsonLikeStrings(value, key = '') {
  if (Array.isArray(value)) return value.map(v => coerceJsonLikeStrings(v, key));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, coerceJsonLikeStrings(v, k)]));
  }
  if (typeof value !== 'string') return value;

  const shouldTryJson = ['snapshot', 'snapshotData', 'data'].includes(key)
    || (value.startsWith('{') && value.endsWith('}'))
    || (value.startsWith('[') && value.endsWith(']'));

  if (!shouldTryJson) return value;

  try {
    return coerceJsonLikeStrings(JSON.parse(value));
  } catch {
    return value;
  }
}

function normalizeTimestamps(value, key = '') {
  if (Array.isArray(value)) return value.map(v => normalizeTimestamps(v, key));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalizeTimestamps(v, k)]));
  }
  if (typeof value !== 'string') return value;

  const isoLike = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
  const timestampKey = /(?:timestamp|createdAt|updatedAt|approvedAt|declinedAt|restoredAt)$/i;
  if (isoLike.test(value) && timestampKey.test(key)) return '__TIMESTAMP__';
  return value;
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = sortObject(value[key]);
    }
    return out;
  }
  return value;
}

function normalize(payload, ignoredPaths = []) {
  const copy = normalizeTimestamps(coerceJsonLikeStrings(structuredClone(payload)));
  for (const p of [...defaultIgnorePaths, ...ignoredPaths]) deleteByPath(copy, p);
  return sortObject(copy);
}

function slugify(value) {
  return String(value || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function call(baseUrl, req) {
  const url = new URL(fillTemplate(req.path), baseUrl);
  const headers = fillTemplate(req.headers || {});
  const bodyValue = req.body == null ? null : fillTemplate(req.body);

  const res = await fetch(url, {
    method: req.method,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: bodyValue == null ? undefined : JSON.stringify(bodyValue),
  });

  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  return { status: res.status, body };
}

let failures = 0;
let stepsTotal = 0;
const mismatches = [];

for (const scenario of scenarios.scenarios) {
  const ignoredPaths = scenario.ignorePaths || [];
  const sequence = scenario.sequence || [];

  for (const step of sequence) {
    stepsTotal += 1;
    const nodeRes = await call(nodeBase, step.request);
    const javaRes = await call(javaBase, step.request);

    const nodeBody = normalize(nodeRes.body, ignoredPaths);
    const javaBody = normalize(javaRes.body, ignoredPaths);

    const sameStatus = nodeRes.status === javaRes.status;
    const sameBody = JSON.stringify(nodeBody) === JSON.stringify(javaBody);

    if (!sameStatus || !sameBody) {
      failures += 1;
      const mismatch = {
        scenario: scenario.name,
        step: step.name,
        request: step.request,
        status: {
          node: nodeRes.status,
          java: javaRes.status,
          same: sameStatus,
        },
        body: {
          same: sameBody,
          node: nodeBody,
          java: javaBody,
        },
      };
      mismatches.push(mismatch);
      const mismatchDir = path.join(artifactsDir, `${slugify(scenario.name)}--${slugify(step.name)}`);
      fs.mkdirSync(mismatchDir, { recursive: true });
      fs.writeFileSync(path.join(mismatchDir, 'node.json'), JSON.stringify(nodeRes, null, 2));
      fs.writeFileSync(path.join(mismatchDir, 'java.json'), JSON.stringify(javaRes, null, 2));
      console.error(`\n[FAIL] ${scenario.name} / ${step.name}`);
      if (!sameStatus) console.error(`  status: node=${nodeRes.status}, java-jpa=${javaRes.status}`);
      if (!sameBody) {
        console.error(`  node body: ${JSON.stringify(nodeBody)}`);
        console.error(`  java body: ${JSON.stringify(javaBody)}`);
      }
    } else {
      console.log(`[OK] ${scenario.name} / ${step.name}`);
    }

    if (step.capture) {
      for (const [varName, pathExpr] of Object.entries(step.capture)) {
        context[varName] = getByPath(nodeRes.body, pathExpr);
      }
    }
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  scenarioFile: scenarioPath,
  totals: {
    scenarios: scenarios.scenarios?.length || 0,
    steps: stepsTotal,
    failures,
  },
  mismatches,
};

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`\nParity report written: ${reportPath}`);

if (failures > 0) {
  console.error(`\nFunctional parity check failed: ${failures} mismatch(es)`);
  process.exit(1);
}

console.log('\nFunctional parity check passed with zero mismatches.');
