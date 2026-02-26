const FORBIDDEN_DEV_AUTH_ENVS = new Set(['production', 'prod', 'preprod', 'staging']);

function resolveRuntimeEnv() {
  return String(process.env.RUNTIME_ENV || process.env.APP_ENV || process.env.NODE_ENV || 'dev').toLowerCase();
}

function validateAuthMode({ authMode, runtimeEnv }) {
  if (authMode !== 'dev') return;

  if (FORBIDDEN_DEV_AUTH_ENVS.has(runtimeEnv)) {
    throw new Error(`AUTH_MODE=dev is forbidden for runtime env: ${runtimeEnv}`);
  }
}

export function getConfig() {
  const port = Number(process.env.PORT || 8787);
  const host = process.env.HOST || '0.0.0.0';
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const authMode = process.env.AUTH_MODE || 'dev';
  const jwtSecret = process.env.JWT_SECRET || '';
  const runtimeEnv = resolveRuntimeEnv();
  const corsOrigin = process.env.CORS_ORIGIN || process.env.FRONTEND_URL || '';

  if (authMode === 'jwt' && !jwtSecret) {
    throw new Error('Missing JWT_SECRET for AUTH_MODE=jwt');
  }

  validateAuthMode({ authMode, runtimeEnv });

  return { port, host, supabaseUrl, supabaseServiceRoleKey, authMode, jwtSecret, runtimeEnv, corsOrigin };
}
