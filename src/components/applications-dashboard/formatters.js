import { ROLES } from '@lib/constants';
import { DASHBOARD_DEFAULTS } from './config';

export const formatDate = dateStr => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export const getDefaultTaskFilterForRole = role => {
  if (role === ROLES.CONTROLLER) return 'review';
  if (role === ROLES.BRANCH_MANAGER) return 'pending_decline';
  return DASHBOARD_DEFAULTS.TASK_FILTER;
};
