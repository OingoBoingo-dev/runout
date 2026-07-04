import type { SupabaseClient, User } from '@supabase/supabase-js';
import { supabaseServer } from '@/lib/supabase/server';

export interface ActionError {
  error: string;
}

/** Resolve the acting user or an error result. */
export async function requireUser(): Promise<
  { supabase: SupabaseClient; user: User } | ActionError
> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'You need to be signed in for that.' };
  return { supabase, user };
}

/**
 * Simple sliding-window mutation rate limit: at most `max` activity rows for
 * this user in the last `windowSec` seconds. Activity is written by DB
 * triggers on publish/rate/follow/comment, so it doubles as a mutation log.
 */
export async function rateLimited(
  supabase: SupabaseClient,
  userId: string,
  max = 30,
  windowSec = 60,
): Promise<boolean> {
  const cutoff = new Date(Date.now() - windowSec * 1000).toISOString();
  const { count } = await supabase
    .from('activity')
    .select('id', { count: 'exact', head: true })
    .eq('actor', userId)
    .gte('created_at', cutoff);
  return (count ?? 0) >= max;
}
