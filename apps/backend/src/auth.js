import { createHmac, timingSafeEqual } from 'node:crypto';

const BASE64URL_REPLACE = [
  ['-', '+'],
  ['_', '/'],
];

const decodeBase64Url = value => {
  let normalized = String(value || '');
  BASE64URL_REPLACE.forEach(([from, to]) => {
    normalized = normalized.replaceAll(from, to);
  });

  const padding = normalized.length % 4;
  if (padding) normalized += '='.repeat(4 - padding);

  return Buffer.from(normalized, 'base64').toString('utf8');
};

const encodeBase64Url = (obj) => {
  const b64 = Buffer.from(JSON.stringify(obj)).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const signHs256 = (headerB64, payloadB64, secret) => {
  const data = `${headerB64}.${payloadB64}`;
  return createHmac('sha256', secret).update(data).digest('base64url');
};

export const generateJwtHs256 = (payload, secret, expiresInMs = 24 * 60 * 60 * 1000) => {
  const headerB64 = encodeBase64Url({ alg: 'HS256', typ: 'JWT' });
  const payloadB64 = encodeBase64Url({
    ...payload,
    exp: Math.floor((Date.now() + expiresInMs) / 1000),
    iat: Math.floor(Date.now() / 1000)
  });
  const signatureB64 = signHs256(headerB64, payloadB64, secret);
  return `${headerB64}.${payloadB64}.${signatureB64}`;
};

const parseJwtHs256 = (token, secret) => {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return { ok: false, reason: 'TOKEN_FORMAT_INVALID' };

  const [headerB64, payloadB64, signatureB64] = parts;

  let header;
  let payload;
  try {
    header = JSON.parse(decodeBase64Url(headerB64));
    payload = JSON.parse(decodeBase64Url(payloadB64));
  } catch {
    return { ok: false, reason: 'TOKEN_DECODE_FAILED' };
  }

  if (header?.alg !== 'HS256') return { ok: false, reason: 'TOKEN_ALG_UNSUPPORTED' };

  const expectedSignature = signHs256(headerB64, payloadB64, secret);
  const provided = Buffer.from(signatureB64);
  const expected = Buffer.from(expectedSignature);

  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return { ok: false, reason: 'TOKEN_SIGNATURE_INVALID' };
  }

  if (payload?.exp && Number(payload.exp) * 1000 <= Date.now()) {
    return { ok: false, reason: 'TOKEN_EXPIRED' };
  }

  return { ok: true, payload };
};

export const buildAuthContext = req => {
  const directUserId = req.headers['x-user-id'];
  const directUserRole = req.headers['x-user-role'];
  if (directUserId && directUserRole) {
    return {
      userId: decodeURIComponent(String(directUserId)),
      userRole: String(directUserRole),
      authType: 'headers',
    };
  }
  return null;
};

export const installAuthMiddleware = (app, config) => {
  const authMode = config.authMode || 'dev';

  app.addHook('preHandler', async (req, reply) => {
    // Пропускаем роут логина, так как токена еще нет
    if (!req.url.startsWith('/api/v1/') || req.url.startsWith('/api/v1/auth/login')) return;

    const authHeader = req.headers.authorization;
    const bearer = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : null;

    let jwtAuth = null;
    if (bearer && config.jwtSecret) {
      const verified = parseJwtHs256(bearer, config.jwtSecret);
      if (verified.ok) {
        const payload = verified.payload || {};
        const userId = String(payload.sub || payload.userId || payload.user_id || '').trim();
        const userRole = String(payload.role || payload.userRole || payload.user_role || '').trim();
        if (userId && userRole) {
          jwtAuth = { userId, userRole, authType: 'jwt' };
          // Больше не прокидываем обратно в заголовки, храним только в контексте
        }
      } else if (authMode === 'jwt') {
        return reply.code(401).send({
          code: 'UNAUTHORIZED',
          message: `JWT auth failed: ${verified.reason}`,
          details: null,
          requestId: req.id,
        });
      }
    } else if (authMode === 'jwt') {
      return reply.code(401).send({
        code: 'UNAUTHORIZED',
        message: 'Missing Bearer token',
        details: null,
        requestId: req.id,
      });
    }

    // Если режим DEV, позволяем фоллбэк на заголовки. Иначе — строго JWT.
    const fallbackAuth = authMode === 'dev' ? buildAuthContext(req) : null;
    const auth = jwtAuth || fallbackAuth;

    if (authMode === 'jwt' && !auth) {
      return reply.code(401).send({
        code: 'UNAUTHORIZED',
        message: 'Unable to resolve auth context',
        details: null,
        requestId: req.id,
      });
    }

    req.authContext = auth;
  });
};

export const hasAnyRole = (role, roles = []) => roles.includes(role);

export const getActorFromRequest = req => {
  // СТРОГАЯ БЕЗОПАСНОСТЬ: Доверяем ТОЛЬКО контексту, который сформировал middleware
  // Никакого чтения req.headers['x-user-id'] здесь быть не должно, чтобы исключить спуфинг.
  return req.authContext || null;
};

export const requireActor = (req, reply) => {
  const actor = getActorFromRequest(req);
  if (!actor) {
    reply.code(401).send({
      code: 'UNAUTHORIZED',
      message: 'Missing auth context',
      details: null,
      requestId: req.id,
    });
    return null;
  }
  return actor;
};