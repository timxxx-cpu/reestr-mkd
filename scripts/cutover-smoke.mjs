import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const flags = {
  VITE_BFF_ENABLED: 'true',
  VITE_LEGACY_ROLLBACK_ENABLED: 'false',
};

const run = (cmd, env = {}) => {
  const startedAt = Date.now();
  try {
    execSync(cmd, {
      stdio: 'pipe',
      encoding: 'utf8',
      env: { ...process.env, ...env },
    });
    return { cmd, ok: true, durationMs: Date.now() - startedAt, error: null };
  } catch (error) {
    return {
      cmd,
      ok: false,
      durationMs: Date.now() - startedAt,
      error: String(error?.stderr || error?.message || error),
    };
  }
};

const checks = [
  run('npm test --prefix apps/backend'),
  run('npm run test:smoke', flags),
  run('npm run build', flags),
];

const passed = checks.every(item => item.ok);
const now = new Date().toISOString();

const report = `# Cutover smoke report\n\n- generatedAt: ${now}\n- mode: backend-first (global BFF enabled, legacy rollback disabled)\n- result: ${passed ? 'PASS' : 'FAIL'}\n\n## Flags\n\n\`\`\`json\n${JSON.stringify(flags, null, 2)}\n\`\`\`\n\n## Checks\n\n${checks
  .map(
    item => `- ${item.ok ? '✅' : '❌'} ${item.cmd} (${item.durationMs}ms)${
      item.ok ? '' : `\n\n  Error:\n\n  \`\`\`\n${item.error}\n\`\`\``
    }`
  )
  .join('\n')}\n\n## Next actions\n\n- If FAIL: keep \`VITE_LEGACY_ROLLBACK_ENABLED=true\` in emergency profile only.\n- If PASS: proceed with backend-only rehearsal and monitor \`window.__reestrOperationSource.getSummary()\`.\n`;

mkdirSync('tmp/reports', { recursive: true });
writeFileSync('tmp/reports/cutover-smoke-report.md', report, 'utf8');

if (!passed) process.exitCode = 1;
