import { BffClient } from '@lib/bff-client';
import { AuthService } from '@lib/auth-service';

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
    userRole: actor.userRole || currentUser?.role || 'technician',
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
