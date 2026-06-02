import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Production Configuration Error: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables are required. Please check your .env file.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

// A robust utility to format raw Supabase / Postgres errors into highly descriptive and friendly guidelines.
export const formatSupabaseError = (err: any): string => {
  if (!err) return '';
  const msg = err.message || '';
  const code = err.code || '';
  
  console.error('[Supabase Audit Log] Database Error Intercept:', { code, msg, err });
  
  if (code === '42P01' || msg.toLowerCase().includes('relation') || msg.toLowerCase().includes('could not find')) {
    return 'Database table missing. Please run database migrations in supabase/migrations/ to provision the schema.';
  }
  if (code === '42501' || msg.toLowerCase().includes('row-level security') || msg.toLowerCase().includes('rls')) {
    return 'Access Denied: RLS security policies blocked this request.';
  }
  if (code === '23505' || msg.toLowerCase().includes('unique constraint') || msg.toLowerCase().includes('already exists')) {
    return 'A record with this name already exists in the system database.';
  }
  if (code === 'PGRST104' || msg.toLowerCase().includes('schema cache')) {
    return 'PostgREST Schema cache stale. Please reload the schema cache on your Supabase dashboard.';
  }
  return msg || 'Database connectivity error. Check your network or connection.';
};
