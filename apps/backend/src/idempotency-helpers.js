import { sendError } from './http-helpers.js';

export function buildIdempotencyContext(req, actor) {
  const rawKey = req.headers['x-idempotency-key'];
  if (!rawKey) return null;

  const idempotencyKey = String(rawKey).trim();
  if (!idempotencyKey) return null;

  const scope = req.routeOptions?.url || req.url || 'unknown';
  const actorScope = actor?.userId || 'anonymous';
  const bodyFingerprint = JSON.stringify(req.body ?? null);

  return {
    cacheKey: `${scope}:${actorScope}:${idempotencyKey}`,
    fingerprint: `${req.method}:${scope}:${bodyFingerprint}`,
  };
}

export function tryServeIdempotentResponse(idempotencyStore, idempotencyContext, reply) {
  if (!idempotencyContext) return false;

  const state = idempotencyStore.get(idempotencyContext.cacheKey, idempotencyContext.fingerprint);
  if (state.status === 'hit') {
    reply.send(state.value);
    return true;
  }

  if (state.status === 'conflict') {
    sendError(reply, 409, 'IDEMPOTENCY_CONFLICT', 'Idempotency key was already used with a different payload');
    return true;
  }

  return false;
}

export function rememberIdempotentResponse(idempotencyStore, idempotencyContext, payload) {
  if (!idempotencyContext) return;
  idempotencyStore.set(idempotencyContext.cacheKey, idempotencyContext.fingerprint, payload);
}
