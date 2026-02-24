import { requireActor } from './auth.js';
import { allowByPolicy } from './policy.js';

export function sendError(reply, statusCode, code, message, details = null) {
  return reply.code(statusCode).send({ code, message, details, requestId: reply.request.id });
}

export function requirePolicyActor(req, reply, { module, action, forbiddenMessage }) {
  const actor = requireActor(req, reply);
  if (!actor) return null;

  if (!allowByPolicy(actor.userRole, module, action)) {
    sendError(reply, 403, 'FORBIDDEN', forbiddenMessage);
    return null;
  }

  return actor;
}
