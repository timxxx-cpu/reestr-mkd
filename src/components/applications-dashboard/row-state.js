import {
  ROLES,
  APP_STATUS,
  APP_STATUS_LABELS,
  SUBSTATUS_LABELS,
  WORKFLOW_SUBSTATUS,
  STEPS_CONFIG,
} from '../../lib/constants.js';
import { getStageColor } from '../../lib/utils.js';

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
    !app.assigneeName || app.assigneeName === user.name || app.assigneeName === user.code;

  const fallbackCanEdit =
    (user.role === ROLES.TECHNICIAN &&
      isAssignedToCurrentTechnician &&
      [
        WORKFLOW_SUBSTATUS.DRAFT,
        WORKFLOW_SUBSTATUS.REVISION,
        WORKFLOW_SUBSTATUS.RETURNED_BY_MANAGER,
        WORKFLOW_SUBSTATUS.INTEGRATION,
      ].includes(substatus)) ||
    (user.role === ROLES.CONTROLLER && substatus === WORKFLOW_SUBSTATUS.REVIEW);

  const canEdit =
    (availableActions?.includes('edit') || fallbackCanEdit) &&
    (user.role !== ROLES.TECHNICIAN || isAssignedToCurrentTechnician);

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
      [ROLES.ADMIN, ROLES.BRANCH_MANAGER, ROLES.CONTROLLER].includes(user.role),
    canReturnFromDecline:
      (availableActions?.includes('return_from_decline') || false) &&
      [ROLES.ADMIN, ROLES.BRANCH_MANAGER].includes(user.role),
    canReassign:
      (availableActions?.includes('reassign') || false) &&
      [ROLES.ADMIN, ROLES.BRANCH_MANAGER].includes(user.role),
    canDelete: (availableActions?.includes('delete') || false) && user.role === ROLES.ADMIN,
  };
};
