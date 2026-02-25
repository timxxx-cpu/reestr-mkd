import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dashboardSource = readFileSync('src/components/ApplicationsDashboard.jsx', 'utf8');
const moderationActionsSource = readFileSync(
  'src/components/applications-dashboard/useProjectModerationActions.js',
  'utf8'
);
const apiServiceSource = readFileSync('src/lib/api-service.js', 'utf8');

test('DECLINE action in ApplicationsDashboard is routed through ApiService', () => {
  assert.match(
    moderationActionsSource,
    /ApiService\.declineApplication\s*\(\{[\s\S]*applicationId:[\s\S]*nextSubstatus:[\s\S]*reason:[\s\S]*\}\)/,
    'DECLINE flow must call ApiService.declineApplication with expected payload'
  );

  assert.match(
    moderationActionsSource,
    /getDeclineSubstatusByRole\(user\.role\)/,
    'DECLINE flow must derive nextSubstatus from role rule helper'
  );

  assert.doesNotMatch(
    dashboardSource,
    /import\('@lib\/supabase'\)/,
    'ApplicationsDashboard should not dynamically import Supabase for DECLINE flow'
  );

  assert.doesNotMatch(
    dashboardSource,
    /\.from\('application_history'\)\.insert\(/,
    'ApplicationsDashboard should not write application_history directly'
  );
});

test('ApiService decline path remains backend-aware with BFF gate', () => {
  assert.match(
    apiServiceSource,
    /declineApplication:\s*async\s*\([^)]*\)\s*=>\s*\{[\s\S]*requireBffEnabled\('workflow\.declineApplication'\)[\s\S]*BffClient\.declineApplication\(/,
    'ApiService declineApplication should enforce BFF guard and route through BffClient.declineApplication'
  );
});
