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

  function removeAt(target, index) {
    if (target == null) return;
    if (index >= parts.length) return;

    const part = parts[index];
    const isLast = index === parts.length - 1;

    if (part === '*') {
      if (Array.isArray(target)) {
        for (const item of target) removeAt(item, index + 1);
      } else if (typeof target === 'object') {
        for (const value of Object.values(target)) removeAt(value, index + 1);
      }
      return;
    }

    if (Array.isArray(target)) {
      const arrayIndex = Number(part);
      if (Number.isInteger(arrayIndex) && arrayIndex >= 0 && arrayIndex < target.length) {
        if (isLast) {
          delete target[arrayIndex];
        } else {
          removeAt(target[arrayIndex], index + 1);
        }
      }
      return;
    }

    if (typeof target !== 'object') return;

    if (isLast) {
      if (part in target) delete target[part];
      return;
    }

    if (part in target) removeAt(target[part], index + 1);
  }
  
  removeAt(obj, 0)
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

// ДОБАВЛЕНА НОВАЯ ФУНКЦИЯ:
function parseJsonStrings(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    // Проверяем, похожа ли строка на JSON объект или массив
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        const parsed = JSON.parse(trimmed);
        return parseJsonStrings(parsed); // Рекурсивно проверяем вложенные свойства
      } catch {
        // Возвращаем оригинальное значение, если это не валидный JSON
      }
    }
  }
  if (Array.isArray(value)) return value.map(parseJsonStrings);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = parseJsonStrings(v);
    }
    return out;
  }
  return value;
}

// ОБНОВЛЕННАЯ ФУНКЦИЯ:
function normalize(payload, ignoredPaths = []) {
  let copy = structuredClone(payload);
  copy = parseJsonStrings(copy); // Применяем парсинг строк перед нормализацией
  for (const p of [...defaultIgnorePaths, ...ignoredPaths]) deleteByPath(copy, p);
  return sortObject(copy);
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
