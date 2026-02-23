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

  if (authMode === 'jwt' && !jwtSecret) {
    throw new Error('Missing JWT_SECRET for AUTH_MODE=jwt');
  }

  return { port, host, supabaseUrl, supabaseServiceRoleKey, authMode, jwtSecret };
}
