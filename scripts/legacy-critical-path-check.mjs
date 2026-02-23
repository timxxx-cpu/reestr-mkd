import { readFileSync, writeFileSync } from 'node:fs';

const source = readFileSync('src/lib/api-service.js', 'utf8');

const criticalChecks = [
  { name: 'acquireApplicationLock', mustContain: "if (BffClient.isEnabled())" },
  { name: 'completeWorkflowStepViaBff', mustContain: "if (!BffClient.isEnabled()) return null;" },
  { name: 'createProjectFromApplication', mustContain: "if (BffClient.isProjectInitEnabled())" },
  { name: 'updateProjectPassport', mustContain: "if (BffClient.isProjectPassportEnabled())" },
  { name: 'getBasements', mustContain: "if (BffClient.isBasementsEnabled())" },
  { name: 'createVersion', mustContain: "if (BffClient.isVersioningEnabled())" },
  { name: 'getProjectFullRegistry', mustContain: "if (BffClient.isFullRegistryEnabled())" },
];

const results = criticalChecks.map(item => ({
  ...item,
  ok: source.includes(item.mustContain),
}));

const allOk = results.every(item => item.ok);

const report = `# Critical legacy-path static check\n\n- result: ${allOk ? 'PASS' : 'FAIL'}\n- assumption: backend-first default and emergency-only legacy rollback (` +
  '`VITE_LEGACY_ROLLBACK_ENABLED=true` only)\n\n## Checks\n\n' +
  results.map(r => `- ${r.ok ? '✅' : '❌'} ${r.name}`).join('\n') +
  '\n\n## Note\n\nThis is a static safety check. Runtime confirmation for real users is tracked via DEV summary: `window.__reestrOperationSource.getSummary()`.\n';

writeFileSync('docs/project/legacy-critical-path-report.md', report, 'utf8');

if (!allOk) process.exitCode = 1;
