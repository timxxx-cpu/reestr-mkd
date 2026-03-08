import { BffClient } from '@lib/bff-client';
import { AuthService } from '@lib/auth-service';
import { ROLE_IDS, getRoleId, getRoleKey } from '@lib/roles';

export const resolveActor = (actor = {}) => {
  const currentUser = AuthService.getCurrentUser?.() || null;

  return {
    userName:
      actor.userName ||
      currentUser?.name ||
      currentUser?.displayName ||
      currentUser?.email ||
      currentUser?.id ||
      'unknown',
    userRoleId: getRoleId(actor.userRoleId ?? actor.userRole ?? currentUser?.roleId ?? currentUser?.role) || ROLE_IDS.TECHNICIAN,
    userRole:
      getRoleKey(actor.userRole ?? actor.userRoleId ?? currentUser?.role ?? currentUser?.roleId) || 'technician',
  };
};

export const requireBffEnabled = operation => {
  if (!BffClient.isEnabled()) {
    throw new Error(`BFF backend is required for operation: ${operation}`);
  }
};

export const createIdempotencyKey = (operation, scopeParts = []) => {
  const normalizedScope = scopeParts
    .filter(Boolean)
    .map(part => String(part).trim())
    .join(':');

  const suffix =
    typeof crypto?.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return normalizedScope ? `${operation}:${normalizedScope}:${suffix}` : `${operation}:${suffix}`;
};
