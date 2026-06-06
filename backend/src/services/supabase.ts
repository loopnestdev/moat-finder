import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} environment variable is not set`);
  return value;
}

const supabaseUrl = requireEnv('SUPABASE_URL');
const anonKey = requireEnv('SUPABASE_ANON_KEY');
const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

/**
 * Anon client — uses the public anon key.
 * Respects Row Level Security. Use for all public-facing reads.
 * All queries target the `moat` schema in coredb.
 */
export const anonClient = createClient<Database, 'moat'>(supabaseUrl, anonKey, {
  db: { schema: 'moat' },
});

/**
 * Admin client — uses the service role key.
 * Bypasses Row Level Security.
 * Use ONLY for: audit log writes, admin operations, pipeline result writes.
 * NEVER expose this client or its key to user-facing route handlers directly.
 */
export const adminClient = createClient<Database, 'moat'>(supabaseUrl, serviceRoleKey, {
  db: { schema: 'moat' },
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
