import { BffClient } from '@lib/bff-client';
export { resolveActor } from '@lib/actor';

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
