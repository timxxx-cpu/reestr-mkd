import { createClient } from '@supabase/supabase-js';

export function createSupabaseAdminClient({ supabaseUrl, supabaseServiceRoleKey }) {
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
