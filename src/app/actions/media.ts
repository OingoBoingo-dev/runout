'use server';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { requireUser, type ActionError } from './guard';

const BUCKET = 'profile-media';
const MAX_BYTES = 4 * 1024 * 1024; // bucket cap
const ALLOWED_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export type MediaKind = 'avatar' | 'background';

const COLUMN: Record<MediaKind, 'avatar_url' | 'background_url'> = {
  avatar: 'avatar_url',
  background: 'background_url',
};

/**
 * Server-only service-role client for storage writes. Built lazily from env;
 * the key never leaves this module and is never logged or returned.
 */
function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function parseKind(raw: unknown): MediaKind | null {
  return raw === 'avatar' || raw === 'background' ? raw : null;
}

/** Detect "column doesn't exist yet" (migration 0003 pending on live DB). */
function isMissingColumn(message: string): boolean {
  return /background_url/i.test(message) && /column|schema cache/i.test(message);
}

/** Best-effort: drop this user's older `${kind}-*` objects, keeping `keepPath`. */
async function pruneOldMedia(
  admin: SupabaseClient,
  userId: string,
  kind: MediaKind,
  keepPath: string | null,
) {
  try {
    const { data: objects } = await admin.storage.from(BUCKET).list(userId);
    const stale = (objects ?? [])
      .filter(o => o.name.startsWith(`${kind}-`))
      .map(o => `${userId}/${o.name}`)
      .filter(p => p !== keepPath);
    if (stale.length) await admin.storage.from(BUCKET).remove(stale);
  } catch {
    // best-effort only — orphaned objects are harmless and re-pruned next upload
  }
}

export async function uploadProfileMedia(
  formData: FormData,
): Promise<{ url: string } | ActionError> {
  const auth = await requireUser();
  if ('error' in auth) return auth;
  const { supabase, user } = auth;

  const kind = parseKind(formData.get('kind'));
  if (!kind) return { error: 'Unknown media kind.' };

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose an image first.' };
  if (file.size > MAX_BYTES) return { error: 'That image is over 4MB — pick a smaller one.' };
  const ext = ALLOWED_EXT[file.type];
  if (!ext) return { error: 'Use a JPEG, PNG, WebP, or GIF.' };

  const admin = serviceClient();
  if (!admin) return { error: 'Media storage is not configured.' };

  const path = `${user.id}/${kind}-${Date.now()}.${ext}`;
  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(path, await file.arrayBuffer(), {
      contentType: file.type,
      cacheControl: '31536000',
      upsert: true,
    });
  if (upErr) return { error: upErr.message };

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
  const url = pub.publicUrl;

  // Persist on the profile with the user's own RLS-scoped client.
  const { error: dbErr } = await supabase
    .from('profiles')
    .update({ [COLUMN[kind]]: url })
    .eq('id', user.id);
  if (dbErr) {
    // Don't leave an orphaned object behind if the row update failed.
    await admin.storage.from(BUCKET).remove([path]).then(
      () => undefined,
      () => undefined,
    );
    if (kind === 'background' && isMissingColumn(dbErr.message)) {
      return { error: 'background storage pending migration' };
    }
    return { error: dbErr.message };
  }

  await pruneOldMedia(admin, user.id, kind, path);
  revalidatePath('/', 'layout');
  return { url };
}

export async function removeProfileMedia(
  rawKind: MediaKind,
): Promise<{ ok: true } | ActionError> {
  const kind = parseKind(rawKind);
  if (!kind) return { error: 'Unknown media kind.' };

  const auth = await requireUser();
  if ('error' in auth) return auth;
  const { supabase, user } = auth;

  const { error: dbErr } = await supabase
    .from('profiles')
    .update({ [COLUMN[kind]]: null })
    .eq('id', user.id);
  if (dbErr) {
    if (kind === 'background' && isMissingColumn(dbErr.message)) {
      return { error: 'background storage pending migration' };
    }
    return { error: dbErr.message };
  }

  const admin = serviceClient();
  if (admin) await pruneOldMedia(admin, user.id, kind, null);

  revalidatePath('/', 'layout');
  return { ok: true };
}
