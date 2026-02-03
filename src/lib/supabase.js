import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rhfllxqyjgvlodnxlgvz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJoZmxseHF5amd2bG9kbnhsZ3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwOTcyNDcsImV4cCI6MjA4NTY3MzI0N30.7pbPsOO6_3GOfc7Kr-cwAApUBl5XoGxAOFC3koiF4ng';

export const supabase = createClient(supabaseUrl, supabaseKey);