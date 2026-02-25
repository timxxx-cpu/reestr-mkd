import test from 'node:test';
import assert from 'node:assert/strict';
import { ROLES, APP_STATUS, WORKFLOW_SUBSTATUS } from '../src/lib/constants.js';
import {
  getDeclineSubstatusByRole,
  DASHBOARD_DECLINE_SUBSTATUS,
} from '../src/components/applications-dashboard/action-rules.js';
import { getProjectRowClassName } from '../src/components/applications-dashboard/row-rules.js';
import { buildProjectRowState } from '../src/components/applications-dashboard/row-state.js';

test('getDeclineSubstatusByRole resolves expected workflow substatus', () => {
  assert.equal(getDeclineSubstatusByRole(ROLES.BRANCH_MANAGER), DASHBOARD_DECLINE_SUBSTATUS.BRANCH_MANAGER);
  assert.equal(getDeclineSubstatusByRole(ROLES.CONTROLLER), DASHBOARD_DECLINE_SUBSTATUS.CONTROLLER);
  assert.equal(getDeclineSubstatusByRole(ROLES.ADMIN), DASHBOARD_DECLINE_SUBSTATUS.ADMIN);
  assert.equal(getDeclineSubstatusByRole(ROLES.TECHNICIAN), DASHBOARD_DECLINE_SUBSTATUS.ADMIN);
});

test('getProjectRowClassName prioritizes decline over other visual states', () => {
  const className = getProjectRowClassName({
    isDeclined: true,
    isPendingDeclineStatus: true,
    isCompleted: true,
  });

  assert.match(className, /border-l-red-500/);
  assert.doesNotMatch(className, /border-l-amber-500/);
  assert.doesNotMatch(className, /border-l-emerald-500/);
});

test('buildProjectRowState computes edit permissions for assigned technician', () => {
  const state = buildProjectRowState({
    project: {
      applicationInfo: {
        status: APP_STATUS.IN_PROGRESS,
        workflowSubstatus: WORKFLOW_SUBSTATUS.DRAFT,
        assigneeName: 'tech-1',
        currentStepIndex: 0,
      },
      availableActions: [],
    },
    user: { role: ROLES.TECHNICIAN, name: 'tech-1', code: 'tech-1' },
  });

  assert.equal(state.canEdit, true);
  assert.equal(state.isDeclined, false);
  assert.equal(state.isCompleted, false);
});

test('buildProjectRowState blocks edit for unassigned technician when no explicit action', () => {
  const state = buildProjectRowState({
    project: {
      applicationInfo: {
        status: APP_STATUS.IN_PROGRESS,
        workflowSubstatus: WORKFLOW_SUBSTATUS.DRAFT,
        assigneeName: 'another-tech',
        currentStepIndex: 0,
      },
      availableActions: [],
    },
    user: { role: ROLES.TECHNICIAN, name: 'tech-1', code: 'tech-1' },
  });

  assert.equal(state.canEdit, false);
});
