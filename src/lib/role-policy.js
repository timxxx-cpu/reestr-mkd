import { APP_STATUS, WORKFLOW_SUBSTATUS } from './constants';
import { ROLE_IDS, getRoleKey, hasAnyRole, hasRole } from './roles';

const TECHNICIAN_EDIT_SUBSTATUSES = Object.freeze([
  WORKFLOW_SUBSTATUS.DRAFT,
  WORKFLOW_SUBSTATUS.REVISION,
  WORKFLOW_SUBSTATUS.RETURNED_BY_MANAGER,
  WORKFLOW_SUBSTATUS.INTEGRATION,
]);

export const isAdmin = value => hasRole(value, ROLE_IDS.ADMIN);
export const isTechnician = value => hasRole(value, ROLE_IDS.TECHNICIAN);
export const isController = value => hasRole(value, ROLE_IDS.CONTROLLER);
export const isBranchManager = value => hasRole(value, ROLE_IDS.BRANCH_MANAGER);
export const isReviewer = value =>
  hasAnyRole(value, [ROLE_IDS.CONTROLLER, ROLE_IDS.BRANCH_MANAGER, ROLE_IDS.ADMIN]);

export const canEditWorkflowByRole = (value, substatus) => {
  if (isAdmin(value)) return true;
  if (isTechnician(value)) return TECHNICIAN_EDIT_SUBSTATUSES.includes(substatus);
  return false;
};

export const canRequestDeclineByRole = (value, substatus) =>
  isTechnician(value) && TECHNICIAN_EDIT_SUBSTATUSES.includes(substatus);

export const canTakeInboxByRole = value =>
  hasAnyRole(value, [ROLE_IDS.ADMIN, ROLE_IDS.BRANCH_MANAGER, ROLE_IDS.CONTROLLER]);

export const canDeclineFromDashboardByRole = (value, status, substatus) => {
  if (status === APP_STATUS.COMPLETED || status === APP_STATUS.DECLINED) return false;
  if (isAdmin(value) || isBranchManager(value)) return true;
  return isController(value) && substatus === WORKFLOW_SUBSTATUS.REVIEW;
};

export const canAssignTechnicianByRole = value =>
  hasAnyRole(value, [ROLE_IDS.ADMIN, ROLE_IDS.BRANCH_MANAGER]);

export const canReviewDeclineRequestByRole = (value, substatus) =>
  substatus === WORKFLOW_SUBSTATUS.PENDING_DECLINE &&
  hasAnyRole(value, [ROLE_IDS.ADMIN, ROLE_IDS.BRANCH_MANAGER]);

export const getDeclineSubstatusByRole = value => {
  if (isBranchManager(value)) return WORKFLOW_SUBSTATUS.DECLINED_BY_MANAGER;
  if (isController(value)) return WORKFLOW_SUBSTATUS.DECLINED_BY_CONTROLLER;
  return WORKFLOW_SUBSTATUS.DECLINED_BY_ADMIN;
};

export const getDefaultTaskFilterForRole = value => {
  if (isController(value)) return 'review';
  if (isBranchManager(value)) return 'pending_decline';
  return null;
};

export const getCanonicalRoleKey = value => getRoleKey(value);
