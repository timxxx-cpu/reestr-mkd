import { sendError } from './http-helpers.js';
import { generateJwtHs256 } from './auth.js';

export function registerAuthRoutes(app, { supabase, config }) {
  app.post('/api/v1/auth/login', async (req, reply) => {
    const { username } = req.body || {};
    
    if (!username) {
      return sendError(reply, 400, 'VALIDATION_ERROR', 'Username is required');
    }

    // Проверяем пользователя в справочнике
    const { data: user, error } = await supabase
      .from('dict_system_users')
      .select('code, name, role, is_active')
      .eq('code', username)
      .single();

    if (error || !user) {
      return sendError(reply, 401, 'UNAUTHORIZED', 'Invalid credentials');
    }

    if (!user.is_active) {
      return sendError(reply, 403, 'FORBIDDEN', 'User account is disabled');
    }

    if (!config.jwtSecret) {
      return sendError(reply, 500, 'SERVER_ERROR', 'JWT_SECRET is not configured on the server');
    }

    // Генерируем токен (срок действия: 24 часа)
    const token = generateJwtHs256({
      sub: user.code,
      role: user.role,
      name: user.name
    }, config.jwtSecret);

    return reply.send({
      ok: true,
      token,
      user: {
        id: user.code,
        name: user.name,
        role: user.role
      }
    });
  });
}