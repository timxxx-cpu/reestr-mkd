/**
 * Вспомогательные функции для маршрутов списка проектов (дашборд).
 */

export function parseCsvParam(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
}

export function normalizeProjectStatusFromDb(status) {
  if (status === 'project') return 'Проектный';
  if (status === 'construction') return 'Строящийся';
  if (status === 'completed') return 'Сдан в эксплуатацию';
  return status || 'Проектный';
}

export function buildProjectAvailableActions(actorRole, projectDto, actorUserId) {
  const app = projectDto?.applicationInfo || {};
  const status = app.status;
  const substatus = app.workflowSubstatus;

  const isCompleted = status === 'COMPLETED';
  const isDeclined = status === 'DECLINED';
  const isPendingDecline = substatus === 'PENDING_DECLINE';

  const actions = ['view'];

  const isAdmin = actorRole === 'admin';
  const isBranchManager = actorRole === 'branch_manager';
  const isTechnician = actorRole === 'technician';
  const isController = actorRole === 'controller';

  const isAssigned = !app.assigneeName || app.assigneeName === actorUserId;

  if (!isCompleted && !isDeclined && (isAdmin || isBranchManager)) actions.push('reassign');
  if (isAdmin) actions.push('delete');
  if ((isAdmin || isBranchManager || isController) && !isCompleted) actions.push('decline');
  if (isPendingDecline && (isAdmin || isBranchManager)) actions.push('return_from_decline');

  const canTechnicianEdit = isTechnician && isAssigned && ['DRAFT', 'REVISION', 'RETURNED_BY_MANAGER', 'INTEGRATION'].includes(substatus);
  const canControllerEdit = isController && substatus === 'REVIEW';

  if (!isCompleted && !isDeclined && (canTechnicianEdit || canControllerEdit || isAdmin)) {
    actions.push('edit');
  }

  return Array.from(new Set(actions));
}
