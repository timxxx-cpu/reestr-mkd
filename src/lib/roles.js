import { ROLES } from './constants';

export const ROLE_IDS = Object.freeze({
  ADMIN: 99,
  TECHNICIAN: 100,
  CONTROLLER: 101,
  BRANCH_MANAGER: 102,
});

const ROLE_KEY_BY_ID = Object.freeze({
  [ROLE_IDS.ADMIN]: ROLES.ADMIN,
  [ROLE_IDS.TECHNICIAN]: ROLES.TECHNICIAN,
  [ROLE_IDS.CONTROLLER]: ROLES.CONTROLLER,
  [ROLE_IDS.BRANCH_MANAGER]: ROLES.BRANCH_MANAGER,
});

const ROLE_ID_BY_KEY = Object.freeze(
  Object.fromEntries(Object.entries(ROLE_KEY_BY_ID).map(([id, key]) => [key, Number(id)]))
);

export const normalizeRoleId = value => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return ROLE_KEY_BY_ID[value] ? value : null;
  }

  const parsed = Number.parseInt(String(value).trim(), 10);
  if (Number.isFinite(parsed) && ROLE_KEY_BY_ID[parsed]) {
    return parsed;
  }

  const key = normalizeRoleKey(value);
  return key ? ROLE_ID_BY_KEY[key] ?? null : null;
};

export const normalizeRoleKey = value => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return ROLE_KEY_BY_ID[value] ?? null;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const parsed = Number.parseInt(raw, 10);
  if (Number.isFinite(parsed) && ROLE_KEY_BY_ID[parsed]) {
    return ROLE_KEY_BY_ID[parsed];
  }

  return ROLE_ID_BY_KEY[raw] ? raw : null;
};

export const normalizeUserRole = user => {
  if (!user) return null;

  const roleId = normalizeRoleId(user.roleId ?? user.userRoleId ?? user.role);
  const role = normalizeRoleKey(user.role ?? user.roleKey ?? roleId);

  return {
    ...user,
    roleId,
    role,
  };
};

export const hasRole = (value, targetRole) => {
  const actualRoleId =
    typeof value === 'object' && value !== null
      ? normalizeRoleId(value.roleId ?? value.userRoleId ?? value.role)
      : normalizeRoleId(value);

  const targetRoleId = normalizeRoleId(targetRole);
  return actualRoleId !== null && actualRoleId === targetRoleId;
};

export const hasAnyRole = (value, roles) => roles.some(role => hasRole(value, role));

export const getRoleId = role => normalizeRoleId(role);
export const getRoleKey = role => normalizeRoleKey(role);
