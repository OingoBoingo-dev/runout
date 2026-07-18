'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdminService } from '@/lib/admin';

type Result = { ok: true } | { error: string };

const idSchema = z.string().uuid();
const decisionSchema = z.enum(['approved', 'rejected']);

/**
 * Neutral failure for non-admin callers — the page 404s rather than
 * advertising the panel, and action responses keep the same posture.
 */
const NOT_FOUND: Result = { error: 'Not found.' };

/** submissions table lands with migration 0004 (PGRST205/42P01 until then). */
const isMissingTable = (code: string | undefined) =>
  code === 'PGRST205' || code === '42P01';

/**
 * Delete a list. FK cascades take list_entries and comments; likes are
 * polymorphic (no FK), so the list's and its comments' likes are swept
 * best-effort afterwards.
 */
export async function deleteList(rawId: unknown): Promise<Result> {
  const parsed = idSchema.safeParse(rawId);
  if (!parsed.success) return { error: 'Invalid list id.' };

  // Defense in depth: re-gate here — never rely on the page gate alone.
  const gate = await requireAdminService();
  if (!gate) return NOT_FOUND;
  const { service } = gate;
  const id = parsed.data;

  // Comment ids first — the cascade is about to remove the rows that the
  // orphan-likes sweep below needs to target.
  const { data: commentRows } = await service.from('comments').select('id').eq('list_id', id);

  const { error } = await service.from('lists').delete().eq('id', id);
  if (error) return { error: error.message };

  // Best-effort sweep; failures leave harmless orphans, never block the delete.
  const commentIds = (commentRows ?? []).map(c => c.id as string);
  await service.from('likes').delete().eq('target_type', 'list').eq('target_id', id);
  if (commentIds.length) {
    await service.from('likes').delete().eq('target_type', 'comment').in('target_id', commentIds);
  }

  revalidatePath('/', 'layout'); // public surfaces lose the list too
  revalidatePath('/admin');
  return { ok: true };
}

/** Delete a single comment (plus its likes — polymorphic, no FK cascade). */
export async function deleteComment(rawId: unknown): Promise<Result> {
  const parsed = idSchema.safeParse(rawId);
  if (!parsed.success) return { error: 'Invalid comment id.' };

  const gate = await requireAdminService();
  if (!gate) return NOT_FOUND;
  const { service } = gate;
  const id = parsed.data;

  const { error } = await service.from('comments').delete().eq('id', id);
  if (error) return { error: error.message };

  await service.from('likes').delete().eq('target_type', 'comment').eq('target_id', id);

  revalidatePath('/', 'layout');
  revalidatePath('/admin');
  return { ok: true };
}

/**
 * Approve or reject a pending submission. v1 marks the queue only (status +
 * reviewed_by/reviewed_at) — approval does NOT create catalog rows; that
 * wiring ships with the submit-flow cycle.
 */
export async function reviewSubmission(rawId: unknown, rawDecision: unknown): Promise<Result> {
  const id = idSchema.safeParse(rawId);
  const decision = decisionSchema.safeParse(rawDecision);
  if (!id.success || !decision.success) return { error: 'Invalid review.' };

  const gate = await requireAdminService();
  if (!gate) return NOT_FOUND;
  const { service, user } = gate;

  const { error } = await service
    .from('submissions')
    .update({
      status: decision.data,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id.data)
    .eq('status', 'pending'); // two admins racing: the second review no-ops
  if (error) {
    if (isMissingTable(error.code)) return { error: 'Submissions arrive with migration 0004.' };
    return { error: error.message };
  }

  revalidatePath('/admin');
  return { ok: true };
}
