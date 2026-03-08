import { ROLES } from './constants';

export const ROLE_IDS = Object.freeze({
  ADMIN: 99,
  TECHNICIAN: 100,
  CONTROLLER: 101,
  BRANCH_MANAGER: 102,
});

export const ROLE_KEYS = Object.freeze({
  ADMIN: ROLES.ADMIN,
  TECHNICIAN: ROLES.TECHNICIAN,
  CONTROLLER: ROLES.CONTROLLER,
  BRANCH_MANAGER: ROLES.BRANCH_MANAGER,
});

export const ROLE_LABELS = Object.freeze({
  [ROLES.ADMIN]: 'Администратор',
  [ROLES.TECHNICIAN]: 'Техник',
  [ROLES.CONTROLLER]: 'Контроллер',
  [ROLES.BRANCH_MANAGER]: 'Начальник филиала',
});

export const ROLE_SHORT_LABELS = Object.freeze({
  [ROLES.ADMIN]: 'Адм',
  [ROLES.TECHNICIAN]: 'Тех',
  [ROLES.CONTROLLER]: 'Бриг',
  [ROLES.BRANCH_MANAGER]: 'Нач',
});

export const ROLE_ACCENT_CLASSES = Object.freeze({
  [ROLES.ADMIN]: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  [ROLES.TECHNICIAN]: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  [ROLES.CONTROLLER]: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  [ROLES.BRANCH_MANAGER]: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
});

const ROLE_KEY_BY_ID = Object.freeze({
  [ROLE_IDS.ADMIN]: ROLE_KEYS.ADMIN,
  [ROLE_IDS.TECHNICIAN]: ROLE_KEYS.TECHNICIAN,
  [ROLE_IDS.CONTROLLER]: ROLE_KEYS.CONTROLLER,
  [ROLE_IDS.BRANCH_MANAGER]: ROLE_KEYS.BRANCH_MANAGER,
});

const ROLE_ID_BY_KEY = Object.freeze(
  Object.fromEntries(Object.entries(ROLE_KEY_BY_ID).map(([id, key]) => [key, Number(id)]))
);

const unwrapRoleValue = value => {
  if (typeof value === 'object' && value !== null) {
    return value.roleId ?? value.userRoleId ?? value.role ?? value.roleKey ?? null;
  }
  return value;
};

export const normalizeRoleId = value => {
  const rawValue = unwrapRoleValue(value);
  if (rawValue === null || rawValue === undefined) return null;
  if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
    return ROLE_KEY_BY_ID[rawValue] ? rawValue : null;
  }

  const parsed = Number.parseInt(String(rawValue).trim(), 10);
  if (Number.isFinite(parsed) && ROLE_KEY_BY_ID[parsed]) {
    return parsed;
  }

  const key = normalizeRoleKey(rawValue);
  return key ? ROLE_ID_BY_KEY[key] ?? null : null;
};

export const normalizeRoleKey = value => {
  const rawValue = unwrapRoleValue(value);
  if (rawValue === null || rawValue === undefined) return null;
  if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
    return ROLE_KEY_BY_ID[rawValue] ?? null;
  }

  const raw = String(rawValue).trim();
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
export const getRoleLabel = role => ROLE_LABELS[getRoleKey(role)] ?? null;
export const getRoleShortLabel = role => ROLE_SHORT_LABELS[getRoleKey(role)] ?? null;
export const getRoleAccentClass = role => ROLE_ACCENT_CLASSES[getRoleKey(role)] ?? null;
