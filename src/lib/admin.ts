import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { supabaseServer } from '@/lib/supabase/server';
import type { Profile } from '@/lib/types';

/**
 * Admin gate. Server-only: importing this from a client component fails at
 * build time because supabaseServer pulls in next/headers.
 *
 * Fail-closed contract — every degraded state reads as "not an admin":
 * signed out, no profile row, any query error, and the pending-0004 world
 * where profiles.is_admin does not exist yet. Callers 404 on null (the panel
 * is invisible, never a login redirect) and server actions independently
 * re-call this before acting.
 */

export type AdminProfile = Profile & {
  /** Absent until migration 0004 lands — undefined reads as "not admin". */
  is_admin?: boolean;
};

export type AdminGate = { user: User; profile: AdminProfile };

/**
 * Resolve the acting admin from the session cookie, or null. Nothing
 * client-supplied is trusted: the user id comes from the verified session and
 * the profile row is fetched fresh here.
 *
 * Pending migration 0004: `select('*')` simply returns rows without an
 * is_admin key (no PGRST204/42703 to special-case), so `!== true` keeps the
 * panel dark for everyone until the column lands; if a variant of the missing
 * schema DOES error, the error path fails closed the same way.
 */
export async function requireAdmin(): Promise<AdminGate | null> {
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    if (error || !data) return null;

    const profile = data as AdminProfile;
    if (profile.is_admin !== true) return null;
    return { user, profile };
  } catch {
    return null; // the gate never throws — unknown failure = not an admin
  }
}

/**
 * Lazy service-role client (the actions/media.ts pattern): built per call
 * from a non-NEXT_PUBLIC env var, module-private, never exported. The only
 * way to obtain it is requireAdminService below, which forces the gate first.
 */
function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Gate + service-role client, fused so the client cannot be reached without
 * passing the gate. Missing service env also returns null (panel stays dark).
 */
export async function requireAdminService(): Promise<
  (AdminGate & { service: SupabaseClient }) | null
> {
  const gate = await requireAdmin();
  if (!gate) return null;
  const service = serviceClient();
  if (!service) return null;
  return { ...gate, service };
}
