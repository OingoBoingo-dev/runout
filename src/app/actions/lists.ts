'use server';

import { revalidatePath } from 'next/cache';
import { listInputSchema } from '@/lib/validate';
import { requireUser, rateLimited } from './guard';

export interface SaveListResult {
  id?: string;
  error?: string;
}

/**
 * Create or update a list plus its entries. Positions are assigned
 * server-side from array order (contiguous 1..n, n <= 999) and every entry's
 * kind is re-verified against the list kind. RLS enforces ownership.
 */
export async function saveList(raw: unknown): Promise<SaveListResult> {
  const parsed = listInputSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid list' };
  const input = parsed.data;

  const auth = await requireUser();
  if ('error' in auth) return auth;
  const { supabase, user } = auth;

  if (await rateLimited(supabase, user.id)) {
    return { error: 'Slow down a little — try again in a minute.' };
  }
  if (input.status === 'published' && input.entries.length === 0) {
    return { error: `Add at least one ${input.kind} before publishing.` };
  }

  // Kind check: every entry must exist in the catalog with the list's kind.
  const mbids = input.entries.map(e => e.mbid);
  if (new Set(mbids).size !== mbids.length) return { error: 'Duplicate entries are not allowed.' };
  if (mbids.length) {
    const { data: items } = await supabase
      .from('catalog_items')
      .select('mbid, kind')
      .in('mbid', mbids);
    const kinds = new Map((items ?? []).map(i => [i.mbid, i.kind]));
    for (const m of mbids) {
      const k = kinds.get(m);
      if (!k) return { error: 'An entry is missing from the catalog — search and re-add it.' };
      if (k !== input.kind) return { error: `This is an ${input.kind} list — a ${k} can’t go on it.` };
    }
  }

  let listId = input.id ?? null;
  if (listId) {
    const { data: existing } = await supabase
      .from('lists')
      .select('id, owner')
      .eq('id', listId)
      .maybeSingle();
    if (!existing || existing.owner !== user.id) return { error: 'Only the author can edit a list.' };
    const { error } = await supabase
      .from('lists')
      .update({
        title: input.title,
        description: input.description,
        kind: input.kind,
        status: input.status,
        list_type: input.list_type,
        genres: input.genres,
      })
      .eq('id', listId);
    if (error) return { error: friendly(error.message) };
  } else {
    const { data, error } = await supabase
      .from('lists')
      .insert({
        owner: user.id,
        title: input.title,
        description: input.description,
        kind: input.kind,
        status: input.status,
        list_type: input.list_type,
        genres: input.genres,
      })
      .select('id')
      .single();
    if (error || !data) return { error: friendly(error?.message) };
    listId = data.id;
  }

  // Replace entries with server-assigned contiguous positions.
  const { error: delErr } = await supabase.from('list_entries').delete().eq('list_id', listId);
  if (delErr) return { error: friendly(delErr.message) };
  if (input.entries.length) {
    const rows = input.entries.map((e, i) => ({
      list_id: listId,
      position: i + 1,
      item_mbid: e.mbid,
      blurb: e.blurb,
    }));
    const { error: insErr } = await supabase.from('list_entries').insert(rows);
    if (insErr) return { error: friendly(insErr.message) };
  }

  revalidatePath('/', 'layout');
  return { id: listId! };
}

/**
 * Quick visibility drop: draft or private only. Publishing always goes
 * through saveList, where the type/genre/entry-count rules are enforced.
 */
export async function setListStatus(
  listId: string,
  status: 'draft' | 'private',
): Promise<SaveListResult> {
  if (status !== 'draft' && status !== 'private') {
    return { error: 'Publishing goes through the publish flow.' };
  }
  const auth = await requireUser();
  if ('error' in auth) return auth;
  const { supabase, user } = auth;
  const { error } = await supabase
    .from('lists')
    .update({ status })
    .eq('id', listId)
    .eq('owner', user.id);
  if (error) return { error: friendly(error.message) };
  revalidatePath('/', 'layout');
  return { id: listId };
}

function friendly(msg?: string): string {
  if (!msg) return 'Something went wrong — try again.';
  if (msg.includes('position')) return 'Positions must be 1–999 with no duplicates.';
  if (msg.includes('check')) return 'That input is outside the allowed limits.';
  return msg;
}
