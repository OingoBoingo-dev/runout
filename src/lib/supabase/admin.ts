import { createClient } from '@supabase/supabase-js';

/**
 * Service-role client. Server-side ONLY (route handlers / server actions /
 * seed). The secret key must never be imported from client components —
 * it is read from a non-NEXT_PUBLIC env var, so it cannot reach the bundle.
 */
export function supabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
