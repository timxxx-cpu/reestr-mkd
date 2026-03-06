import { sendError } from './http-helpers.js';
import { generateJwtHs256 } from './auth.js';

export function registerAuthRoutes(app, { supabase, config }) {
  app.post('/api/v1/auth/login', async (req, reply) => {
    const { username, password } = req.body || {};
    const login = String(username || '').trim();
    
    if (!login || !password) {
      return sendError(reply, 400, 'VALIDATION_ERROR', 'Username and password are required');
    }

    const { data: user, error } = await supabase
      .schema('general')
      .from('users')
      .select('id, login, password, full_name, status')
      .eq('login', login)
      .eq('password', password)
      .eq('status', true)
      .limit(1)
      .maybeSingle();

    if (error || !user) {
      return sendError(reply, 401, 'UNAUTHORIZED', 'Invalid credentials');
    }

    const { data: userAttachedRole, error: userAttachedRoleError } = await supabase
      .schema('general')
      .from('user_attached_roles')
      .select('role_id')
      .eq('user_id', user.id)
      .eq('status', true)
      .limit(1)
      .maybeSingle();

    if (userAttachedRoleError || !userAttachedRole) {
      return sendError(reply, 403, 'FORBIDDEN', 'User role is not assigned');
    }

    const { data: roleRow, error: roleError } = await supabase
      .schema('general')
      .from('user_role')
      .select('name_uk')
      .eq('id', userAttachedRole.role_id)
      .limit(1)
      .maybeSingle();

    if (roleError || !roleRow) {
      return sendError(reply, 403, 'FORBIDDEN', 'User role is not resolved');
    }

    const role = String(roleRow.name_uk || '').trim().toLowerCase();
    if (!role) return sendError(reply, 403, 'FORBIDDEN', 'User role is not resolved');

    const displayName = String(user.full_name || user.login || user.id);

    if (!config.jwtSecret) {
      return sendError(reply, 500, 'SERVER_ERROR', 'JWT_SECRET is not configured on the server');
    }

    // Генерируем токен (срок действия: 24 часа)
    const token = generateJwtHs256({
      sub: String(user.id),
      role,
      name: displayName
    }, config.jwtSecret);

    return reply.send({
      ok: true,
      token,
      user: {
        id: String(user.id),
        name: displayName,
        role
      }
    });
  });
}
