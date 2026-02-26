import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dashboardSource = readFileSync('src/components/ApplicationsDashboard.jsx', 'utf8');
const moderationActionsSource = readFileSync(
  'src/components/applications-dashboard/useProjectModerationActions.js',
  'utf8'
);
const apiServiceSource = readFileSync('src/lib/api-service.js', 'utf8');
const workflowDomainSource = readFileSync('src/lib/api/workflow-domain.js', 'utf8');
const projectDomainSource = readFileSync('src/lib/api/project-domain.js', 'utf8');

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

test('Workflow decline path remains backend-aware with BFF gate', () => {
  assert.match(
    workflowDomainSource,
    /declineApplication:\s*async\s*\([^)]*\)\s*=>\s*\{[\s\S]*requireBffEnabled\('workflow\.declineApplication'\)[\s\S]*BffClient\.declineApplication\(/,
    'Workflow domain declineApplication should enforce BFF guard and route through BffClient.declineApplication'
  );

  assert.match(
    apiServiceSource,
    /\.\.\.createWorkflowDomainApi\(\{\s*BffClient,\s*requireBffEnabled,\s*resolveActor,\s*createIdempotencyKey\s*\}\)/,
    'ApiService should compose workflow domain API in LegacyApiService'
  );
});


test('Project domain contract remains backend-aware and composed in ApiService', () => {
  assert.match(
    projectDomainSource,
    /createProjectFromApplication:\s*async\s*\([^)]*\)\s*=>\s*\{[\s\S]*requireBffEnabled\('project\.createProjectFromApplication'\)[\s\S]*BffClient\.createProjectFromApplication\(/,
    'Project domain createProjectFromApplication should enforce BFF guard and route through BffClient.createProjectFromApplication'
  );

  assert.match(
    projectDomainSource,
    /saveData:\s*async\s*\([^)]*\)\s*=>\s*\{[\s\S]*requireBffEnabled\('project\.saveData'\)[\s\S]*BffClient\.saveProjectContextMeta\([\s\S]*BffClient\.saveProjectBuildingDetails\([\s\S]*BffClient\.saveStepBlockStatuses\(/,
    'Project domain saveData should stay BFF-gated and persist context meta/details/step statuses via BffClient'
  );

  assert.match(
    apiServiceSource,
    /\.\.\.createProjectDomainApi\(\{[\s\S]*BffClient,[\s\S]*requireBffEnabled,[\s\S]*resolveActor,[\s\S]*createIdempotencyKey,[\s\S]*mapProjectAggregate,[\s\S]*mapBuildingFromDB,[\s\S]*mapBlockDetailsFromDB[\s\S]*\}\)/,
    'ApiService should compose project domain API in LegacyApiService'
  );
});
