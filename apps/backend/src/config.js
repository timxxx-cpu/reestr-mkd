export function getConfig() {
  const port = Number(process.env.PORT || 8787);
  const host = process.env.HOST || '0.0.0.0';
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return { port, host, supabaseUrl, supabaseServiceRoleKey };
}
