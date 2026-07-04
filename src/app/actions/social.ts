'use server';

import { revalidatePath } from 'next/cache';
import { commentSchema, followSchema, likeSchema, pinSchema, ratingSchema } from '@/lib/validate';
import { requireUser, rateLimited, type ActionError } from './guard';

type Result = { ok: true } | ActionError;

export async function rateItem(raw: unknown): Promise<Result> {
  const parsed = ratingSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid rating' };
  const auth = await requireUser();
  if ('error' in auth) return auth;
  const { supabase, user } = auth;
  if (await rateLimited(supabase, user.id)) return { error: 'Slow down a little — try again in a minute.' };
  const { error } = await supabase.from('ratings').upsert(
    { user_id: user.id, item_mbid: parsed.data.itemMbid, value: parsed.data.value },
    { onConflict: 'user_id,item_mbid' },
  );
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function toggleFollow(raw: unknown): Promise<Result> {
  const parsed = followSchema.safeParse(raw);
  if (!parsed.success) return { error: 'Invalid user' };
  const auth = await requireUser();
  if ('error' in auth) return auth;
  const { supabase, user } = auth;
  const followee = parsed.data.userId;
  if (followee === user.id) return { error: 'Following yourself is a bit much.' };
  const { data: existing } = await supabase
    .from('follows')
    .select('followee')
    .eq('follower', user.id)
    .eq('followee', followee)
    .maybeSingle();
  const { error } = existing
    ? await supabase.from('follows').delete().eq('follower', user.id).eq('followee', followee)
    : await supabase.from('follows').insert({ follower: user.id, followee });
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function toggleLike(raw: unknown): Promise<Result> {
  const parsed = likeSchema.safeParse(raw);
  if (!parsed.success) return { error: 'Invalid target' };
  const auth = await requireUser();
  if ('error' in auth) return auth;
  const { supabase, user } = auth;
  const { targetType, targetId } = parsed.data;
  const { data: existing } = await supabase
    .from('likes')
    .select('target_id')
    .eq('user_id', user.id)
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .maybeSingle();
  const { error } = existing
    ? await supabase
        .from('likes')
        .delete()
        .eq('user_id', user.id)
        .eq('target_type', targetType)
        .eq('target_id', targetId)
    : await supabase.from('likes').insert({ user_id: user.id, target_type: targetType, target_id: targetId });
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function addComment(raw: unknown): Promise<Result> {
  const parsed = commentSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid comment' };
  const auth = await requireUser();
  if ('error' in auth) return auth;
  const { supabase, user } = auth;
  if (await rateLimited(supabase, user.id, 10, 60)) {
    return { error: 'Slow down a little — try again in a minute.' };
  }
  const { error } = await supabase
    .from('comments')
    .insert({ list_id: parsed.data.listId, author: user.id, body: parsed.data.body });
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { ok: true };
}

/** Toggle an item in the profile's pinned top-4. */
export async function togglePin(raw: unknown): Promise<Result> {
  const parsed = pinSchema.safeParse(raw);
  if (!parsed.success) return { error: 'Invalid item' };
  const auth = await requireUser();
  if ('error' in auth) return auth;
  const { supabase, user } = auth;
  const { data: profile } = await supabase
    .from('profiles')
    .select('pinned_items')
    .eq('id', user.id)
    .single();
  const pinned: string[] = profile?.pinned_items ?? [];
  const mbid = parsed.data.itemMbid;
  let next: string[];
  if (pinned.includes(mbid)) next = pinned.filter(p => p !== mbid);
  else if (pinned.length >= 4) return { error: 'Pins cap at four — unpin something first.' };
  else next = [...pinned, mbid];
  const { error } = await supabase.from('profiles').update({ pinned_items: next }).eq('id', user.id);
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { ok: true };
}
