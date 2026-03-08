import { DASHBOARD_DEFAULTS } from './config';
import { getDefaultTaskFilterForRole as resolveDefaultTaskFilterForRole } from '@lib/role-policy';

export const formatDate = dateStr => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export const getDefaultTaskFilterForRole = role => {
  return resolveDefaultTaskFilterForRole(role) || DASHBOARD_DEFAULTS.TASK_FILTER;
};
