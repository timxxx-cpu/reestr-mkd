import fs from 'node:fs';

const nodeBase = process.env.NODE_BACKEND_URL;
const javaBase = process.env.JAVA_JPA_BACKEND_URL;
const scenarioPath = process.env.PARITY_SCENARIOS || 'tests/parity/backend-functional-parity.scenarios.json';

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

function getByPath(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function deleteByPath(obj, path) {
  const parts = path.split('.');
  const last = parts.pop();
  let cursor = obj;
  for (const p of parts) {
    if (cursor == null || typeof cursor !== 'object') return;
    cursor = cursor[p];
  }
  if (cursor && typeof cursor === 'object' && last in cursor) delete cursor[last];
}

function normalize(payload, ignoredPaths = []) {
  const copy = structuredClone(payload);
  for (const p of ignoredPaths) deleteByPath(copy, p);
  return copy;
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

for (const scenario of scenarios.scenarios) {
  const ignoredPaths = scenario.ignorePaths || [];
  const sequence = scenario.sequence || [];

  for (const step of sequence) {
    const nodeRes = await call(nodeBase, step.request);
    const javaRes = await call(javaBase, step.request);

    const nodeBody = normalize(nodeRes.body, ignoredPaths);
    const javaBody = normalize(javaRes.body, ignoredPaths);

    const sameStatus = nodeRes.status === javaRes.status;
    const sameBody = JSON.stringify(nodeBody) === JSON.stringify(javaBody);

    if (!sameStatus || !sameBody) {
      failures += 1;
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
      for (const [varName, path] of Object.entries(step.capture)) {
        context[varName] = getByPath(nodeRes.body, path);
      }
    }
  }
}

if (failures > 0) {
  console.error(`\nFunctional parity check failed: ${failures} mismatch(es)`);
  process.exit(1);
}

console.log('\nFunctional parity check passed with zero mismatches.');
