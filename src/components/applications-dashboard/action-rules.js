import { getDeclineSubstatusByRole as resolveDeclineSubstatusByRole } from '../../lib/role-policy.js';

export const DASHBOARD_DECLINE_SUBSTATUS = {
  ADMIN: 'DECLINED_BY_ADMIN',
  CONTROLLER: 'DECLINED_BY_CONTROLLER',
  BRANCH_MANAGER: 'DECLINED_BY_MANAGER',
};

export const getDeclineSubstatusByRole = role => {
  const substatus = resolveDeclineSubstatusByRole(role);
  if (substatus === 'DECLINED_BY_MANAGER') return DASHBOARD_DECLINE_SUBSTATUS.BRANCH_MANAGER;
  if (substatus === 'DECLINED_BY_CONTROLLER') return DASHBOARD_DECLINE_SUBSTATUS.CONTROLLER;
  return DASHBOARD_DECLINE_SUBSTATUS.ADMIN;
};
