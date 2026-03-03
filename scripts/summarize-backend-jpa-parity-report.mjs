import fs from 'node:fs';

const reportPath = process.argv[2] || process.env.PARITY_REPORT_PATH || 'artifacts/backend-jpa-parity-report.json';

if (!fs.existsSync(reportPath)) {
  console.error(`Parity report not found: ${reportPath}`);
  process.exit(2);
}

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const totals = report.totals || {};
const mismatches = Array.isArray(report.mismatches) ? report.mismatches : [];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const JAVA_LOCAL_DATE_TIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/;

const REASON_META = {
  'auth-gap-java-requires-bearer': {
    hint: 'Java endpoint expects bearer auth while Node endpoint is public/headers-based.',
  },
  'auth-message-contract-drift': {
    hint: 'HTTP status matches (401), but error message/body differs.',
  },
  'java-runtime-failure': {
    hint: 'Java returned 5xx while Node returned non-5xx.',
  },
  'node-runtime-failure': {
    hint: 'Node returned 5xx while Java returned non-5xx.',
  },
  'empty-json-body-contract-drift': {
    hint: 'Node rejects empty JSON body while Java accepts same request.',
  },
  'error-code-contract-drift': {
    hint: 'HTTP status is same but service error code differs.',
  },
  'volatile-uuid-field-drift': {
    hint: 'Response differs only by generated UUID-like fields (non-deterministic ids).',
  },
  'date-format-or-timezone-drift': {
    hint: 'Timestamp payload semantically similar but uses different format/timezone/precision.',
  },
  'snapshot-json-serialization-drift': {
    hint: 'One side returns snapshot as object, the other as JSON string.',
  },
  'other-contract-drift': {
    hint: 'Unclassified contract mismatch. Check mismatch payloads directly.',
  },
};

function looksLikeTimestamp(value) {
  if (typeof value !== 'string') return false;
  if (!Number.isNaN(Date.parse(value))) return true;
  return JAVA_LOCAL_DATE_TIME_RE.test(value);
}

function normalizeJsonStringObject(value) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function stripUuidOnlyDiffs(nodeBody, javaBody) {
  if (!isPlainObject(nodeBody) || !isPlainObject(javaBody)) {
    return { nodeBody, javaBody };
  }

  const nodeCopy = structuredClone(nodeBody);
  const javaCopy = structuredClone(javaBody);

  for (const key of Object.keys(nodeCopy)) {
    if (!(key in javaCopy)) continue;
    const nodeValue = nodeCopy[key];
    const javaValue = javaCopy[key];
    if (typeof nodeValue !== 'string' || typeof javaValue !== 'string') continue;
    if (!UUID_RE.test(nodeValue) || !UUID_RE.test(javaValue)) continue;
    if (nodeValue === javaValue) continue;

    delete nodeCopy[key];
    delete javaCopy[key];
  }

  return { nodeBody: nodeCopy, javaBody: javaCopy };
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (!isPlainObject(value)) return JSON.stringify(value);
  const keys = Object.keys(value).sort();
  return `{${keys.map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
}

function classifyMismatch(mismatch) {
  const nodeStatus = mismatch.status?.node;
  const javaStatus = mismatch.status?.java;
  const nodeBody = mismatch.body?.node;
  const javaBody = mismatch.body?.java;

  if (javaStatus === 401 && nodeStatus !== 401) return 'auth-gap-java-requires-bearer';
  if (nodeStatus === 401 && javaStatus === 401) return 'auth-message-contract-drift';
  if (javaStatus >= 500 && nodeStatus < 500) return 'java-runtime-failure';
  if (nodeStatus >= 500 && javaStatus < 500) return 'node-runtime-failure';

  if (nodeBody?.code === 'FST_ERR_CTP_EMPTY_JSON_BODY' && javaStatus === 200) {
    return 'empty-json-body-contract-drift';
  }

  const nodeCode = nodeBody?.code;
  const javaCode = javaBody?.code;
  if (nodeStatus === javaStatus && nodeCode && javaCode && nodeCode !== javaCode) {
    return 'error-code-contract-drift';
  }

  const nodeExpiresAt = nodeBody?.expiresAt;
  const javaExpiresAt = javaBody?.expiresAt;
  if (looksLikeTimestamp(nodeExpiresAt) && looksLikeTimestamp(javaExpiresAt) && nodeExpiresAt !== javaExpiresAt) {
    return 'date-format-or-timezone-drift';
  }

  const nodeSnapshot = normalizeJsonStringObject(nodeBody?.snapshot_data);
  const javaSnapshot = normalizeJsonStringObject(javaBody?.snapshot_data);
  if (nodeSnapshot !== undefined && javaSnapshot !== undefined) {
    const snapshotSame = stableJson(nodeSnapshot) === stableJson(javaSnapshot);
    if (snapshotSame && typeof nodeBody?.snapshot_data !== typeof javaBody?.snapshot_data) {
      return 'snapshot-json-serialization-drift';
    }
  }

  const stripped = stripUuidOnlyDiffs(nodeBody, javaBody);
  if (stableJson(stripped.nodeBody) === stableJson(stripped.javaBody) && stableJson(nodeBody) !== stableJson(javaBody)) {
    return 'volatile-uuid-field-drift';
  }

  return 'other-contract-drift';
}

console.log(`Report: ${reportPath}`);
console.log(`Generated: ${report.generatedAt || 'unknown'}`);
console.log(`Scenarios: ${totals.scenarios ?? 0}`);
console.log(`Steps: ${totals.steps ?? 0}`);
console.log(`Failures: ${totals.failures ?? mismatches.length}`);

if (mismatches.length === 0) {
  console.log('No mismatches found.');
  process.exit(0);
}

const grouped = new Map();
for (const mismatch of mismatches) {
  const key = mismatch.scenario || 'unknown';
  grouped.set(key, (grouped.get(key) || 0) + 1);
}

console.log('\nMismatch breakdown by scenario:');
for (const [scenario, count] of grouped.entries()) {
  console.log(`- ${scenario}: ${count}`);
}

console.log('\nFirst mismatches:');
for (const mismatch of mismatches.slice(0, 10)) {
  console.log(`- ${mismatch.scenario} / ${mismatch.step} :: status(node=${mismatch.status?.node}, java=${mismatch.status?.java}) bodySame=${mismatch.body?.same}`);
}

const buckets = new Map();
for (const mismatch of mismatches) {
  const reason = classifyMismatch(mismatch);
  const current = buckets.get(reason) || { count: 0, examples: [] };
  current.count += 1;
  if (current.examples.length < 2) {
    current.examples.push(`${mismatch.scenario} / ${mismatch.step}`);
  }
  buckets.set(reason, current);
}

if (buckets.size > 0) {
  console.log('\nProbable root causes:');
  for (const [reason, data] of [...buckets.entries()].sort((a, b) => b[1].count - a[1].count)) {
    const meta = REASON_META[reason] || REASON_META['other-contract-drift'];
    const examples = data.examples.join('; ');
    console.log(`- ${reason}: ${data.count} | ${meta.hint}${examples ? ` | examples: ${examples}` : ''}`);
  }
}