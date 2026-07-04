'use server';

import { revalidatePath } from 'next/cache';
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
