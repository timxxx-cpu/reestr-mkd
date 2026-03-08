import {
  ROLES,
  APP_STATUS,
  APP_STATUS_LABELS,
  SUBSTATUS_LABELS,
  WORKFLOW_SUBSTATUS,
  STEPS_CONFIG,
} from '../../lib/constants.js';
import { getStageColor } from '../../lib/utils.js';
import { ROLE_IDS, hasAnyRole, hasRole } from '../../lib/roles.js';

export const buildProjectRowState = ({ project, user }) => {
  const app = project.applicationInfo || {};
  const info = project.complexInfo || {};
  const substatus = app.workflowSubstatus || WORKFLOW_SUBSTATUS.DRAFT;

  const statusConfig = APP_STATUS_LABELS[app.status] || {
    label: app.status,
    color: getStageColor(app.status),
  };
  const substatusConfig = SUBSTATUS_LABELS[substatus] || statusConfig;

  const isDeclined = app.status === APP_STATUS.DECLINED;
  const isCompleted = app.status === APP_STATUS.COMPLETED;
  const isPendingDeclineStatus = substatus === WORKFLOW_SUBSTATUS.PENDING_DECLINE;

  const currentStepIdx = app.currentStepIndex || 0;
  const stepTitle = STEPS_CONFIG[currentStepIdx]?.title || 'Завершено';

  const availableActions = Array.isArray(project.availableActions) ? project.availableActions : null;

  const isAssignedToCurrentTechnician =
    !app.assigneeName || 
    app.assigneeName === user.name || 
    app.assigneeName === user.code || 
    app.assigneeName === user.id || 
    app.assigneeName === user.username;

  // ИСПРАВЛЕНИЕ: Разрешаем и controller, и branch_manager
  const isReviewerAndReview =
    hasAnyRole(user, [ROLE_IDS.CONTROLLER, ROLE_IDS.BRANCH_MANAGER]) && substatus === WORKFLOW_SUBSTATUS.REVIEW;
  const isAdmin = hasRole(user, ROLE_IDS.ADMIN);

  const fallbackCanEdit =
    (hasRole(user, ROLE_IDS.TECHNICIAN) &&
      isAssignedToCurrentTechnician &&
      [
        WORKFLOW_SUBSTATUS.DRAFT,
        WORKFLOW_SUBSTATUS.REVISION,
        WORKFLOW_SUBSTATUS.RETURNED_BY_MANAGER,
        WORKFLOW_SUBSTATUS.INTEGRATION,
      ].includes(substatus)) ||
    isReviewerAndReview || isAdmin;

  const canEdit = availableActions?.includes('edit') || fallbackCanEdit;

  return {
    app,
    info,
    substatus,
    statusConfig,
    substatusConfig,
    isDeclined,
    isCompleted,
    isPendingDeclineStatus,
    currentStepIdx,
    stepTitle,
    canEdit,
    canDecline:
      (availableActions?.includes('decline') || false) &&
      hasAnyRole(user, [ROLE_IDS.ADMIN, ROLE_IDS.BRANCH_MANAGER, ROLE_IDS.CONTROLLER]),
    canReturnFromDecline:
      (availableActions?.includes('return_from_decline') || false) &&
      hasAnyRole(user, [ROLE_IDS.ADMIN, ROLE_IDS.BRANCH_MANAGER]),
    canReassign:
      (availableActions?.includes('reassign') || false) &&
      hasAnyRole(user, [ROLE_IDS.ADMIN, ROLE_IDS.BRANCH_MANAGER]),
    canDelete: (availableActions?.includes('delete') || false) && hasRole(user, ROLE_IDS.ADMIN),
  };
};
