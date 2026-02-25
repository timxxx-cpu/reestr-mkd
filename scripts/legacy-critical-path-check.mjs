import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const source = readFileSync('src/lib/api-service.js', 'utf8');

const checks = [
  {
    name: 'globalBffGuardHelperPresent',
    ok: /const\s+requireBffEnabled\s*=\s*operation\s*=>/.test(source),
  },
  {
    name: 'bffGuardUsedInApiServiceMethods',
    ok: source.includes("requireBffEnabled('"),
  },
  {
    name: 'legacyConditionalGateRemoved',
    ok: !source.includes('if (BffClient.isEnabled())'),
  },
  {
    name: 'legacyTrackCallsRemoved',
    ok: !source.includes('trackLegacyPath('),
  },
];

const allOk = checks.every(item => item.ok);

const report = `# Critical legacy-path static check

- result: ${allOk ? 'PASS' : 'FAIL'}
- assumption: backend-first default and emergency-only legacy rollback (\`VITE_LEGACY_ROLLBACK_ENABLED=true\` only)

## Checks

${checks.map(r => `- ${r.ok ? '✅' : '❌'} ${r.name}`).join('\n')}

## Note

This is a static safety check for post-cleanup state.
`;

mkdirSync('tmp/reports', { recursive: true });
writeFileSync('tmp/reports/legacy-critical-path-report.md', report, 'utf8');

if (!allOk) process.exitCode = 1;
