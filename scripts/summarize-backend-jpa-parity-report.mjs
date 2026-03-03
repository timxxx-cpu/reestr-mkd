import fs from 'node:fs';

const reportPath = process.argv[2] || process.env.PARITY_REPORT_PATH || 'artifacts/backend-jpa-parity-report.json';

if (!fs.existsSync(reportPath)) {
  console.error(`Parity report not found: ${reportPath}`);
  process.exit(2);
}

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const totals = report.totals || {};
const mismatches = Array.isArray(report.mismatches) ? report.mismatches : [];

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
for (const m of mismatches) {
  const key = m.scenario || 'unknown';
  grouped.set(key, (grouped.get(key) || 0) + 1);
}

console.log('\nMismatch breakdown by scenario:');
for (const [scenario, count] of grouped.entries()) {
  console.log(`- ${scenario}: ${count}`);
}

console.log('\nFirst mismatches:');
for (const m of mismatches.slice(0, 10)) {
  console.log(`- ${m.scenario} / ${m.step} :: status(node=${m.status?.node}, java=${m.status?.java}) bodySame=${m.body?.same}`);
}
