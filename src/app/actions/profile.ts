'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { getBorder } from '@/lib/borders';
import { supabaseServer } from '@/lib/supabase/server';
import { getScheme } from '@/lib/themes';
import { profileSchema } from '@/lib/validate';
import { requireUser, type ActionError } from './guard';

export async function updateProfile(raw: unknown): Promise<{ ok: true } | ActionError> {
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid profile' };
  const auth = await requireUser();
  if ('error' in auth) return auth;
  const { supabase, user } = auth;
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: parsed.data.displayName, bio: parsed.data.bio })
    .eq('id', user.id);
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { ok: true };
}

/** Contributions = published lists + ratings + comments (3 head-only counts). */
async function countContributions(supabase: SupabaseClient, userId: string): Promise<number> {
  const [pubs, rates, notes] = await Promise.all([
    supabase
      .from('lists')
      .select('id', { count: 'exact', head: true })
      .eq('owner', userId)
      .eq('status', 'published'),
    supabase.from('ratings').select('item_mbid', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('comments').select('id', { count: 'exact', head: true }).eq('author', userId),
  ]);
  return (pubs.count ?? 0) + (rates.count ?? 0) + (notes.count ?? 0);
}

/**
 * Unlock data for the theme picker, fetched lazily when the sheet opens.
 * Signed-out (or any failure) degrades to zero contributions / no saved
 * scheme — localStorage theming keeps working regardless.
 */
export async function getThemeAccess(): Promise<{
  contributions: number;
  savedScheme: string | null;
}> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { contributions: 0, savedScheme: null };
  const [contributions, prof] = await Promise.all([
    countContributions(supabase, user.id),
    // Errors (e.g. theme_scheme column pending migration 0003) leave data
    // null, which degrades to "no saved scheme".
    supabase.from('profiles').select('theme_scheme').eq('id', user.id).maybeSingle(),
  ]);
  const savedScheme =
    (prof.data as { theme_scheme?: string | null } | null)?.theme_scheme ?? null;
  return { contributions, savedScheme: getScheme(savedScheme) ? savedScheme : null };
}

/**
 * Persist the chosen scheme (null = stock). Locked schemes are re-checked
 * server-side. While migration 0003 is pending the profiles.theme_scheme
 * column may not exist — that failure is swallowed into a sentinel error so
 * the client keeps the local apply.
 */
export async function saveThemeScheme(id: string | null): Promise<{ ok: true } | ActionError> {
  const scheme = id === null ? null : getScheme(id);
  if (id !== null && !scheme) return { error: 'Unknown scheme' };
  const auth = await requireUser();
  if ('error' in auth) return auth;
  const { supabase, user } = auth;
  if (scheme?.unlockAt) {
    const contributions = await countContributions(supabase, user.id);
    if (contributions < scheme.unlockAt)
      return { error: `Unlocks at ${scheme.unlockAt} contributions` };
  }
  const { error } = await supabase.from('profiles').update({ theme_scheme: id }).eq('id', user.id);
  if (error) {
    // PostgREST "column not found" (PGRST204) → migration not applied yet.
    if (error.code === 'PGRST204' || /theme_scheme|column|schema/i.test(error.message))
      return { error: 'theme sync pending migration' };
    return { error: error.message };
  }
  revalidatePath('/', 'layout');
  return { ok: true };
}

/**
 * Unlock data for the avatar-frame picker, fetched lazily when it mounts.
 * Mirrors getThemeAccess: signed-out (or any failure) degrades to zero
 * contributions / no saved frame, and a missing profiles.border_id column
 * (pending migration) reads as null.
 */
export async function getBorderAccess(): Promise<{
  contributions: number;
  savedBorder: string | null;
}> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { contributions: 0, savedBorder: null };
  const [contributions, prof] = await Promise.all([
    countContributions(supabase, user.id),
    // Errors (e.g. border_id column pending migration) leave data null,
    // which degrades to "no saved frame".
    supabase.from('profiles').select('border_id').eq('id', user.id).maybeSingle(),
  ]);
  const savedBorder =
    (prof.data as { border_id?: string | null } | null)?.border_id ?? null;
  return { contributions, savedBorder: getBorder(savedBorder) ? savedBorder : null };
}

/**
 * Persist the chosen frame (null = today's plain look). Locked frames are
 * re-checked server-side against the same contribution count. A missing
 * profiles.border_id column (pending migration) is swallowed into a sentinel
 * error so the client can keep its local selection.
 */
export async function saveBorder(id: string | null): Promise<{ ok: true } | ActionError> {
  const border = id === null ? null : getBorder(id);
  if (id !== null && !border) return { error: 'Unknown frame' };
  const auth = await requireUser();
  if ('error' in auth) return auth;
  const { supabase, user } = auth;
  if (border?.unlockAt) {
    const contributions = await countContributions(supabase, user.id);
    if (contributions < border.unlockAt)
      return { error: `Unlocks at ${border.unlockAt} contributions` };
  }
  const { error } = await supabase.from('profiles').update({ border_id: id }).eq('id', user.id);
  if (error) {
    // PostgREST "column not found" (PGRST204) → migration not applied yet.
    if (error.code === 'PGRST204' || /border_id|column|schema/i.test(error.message))
      return { error: 'frame sync pending migration' };
    return { error: error.message };
  }
  revalidatePath('/', 'layout');
  return { ok: true };
}
