'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { deleteComment, deleteList, reviewSubmission } from '@/app/actions/admin';

/** Red is reserved for destructive controls — these delete buttons only. */
const DANGER =
  'press rounded-chip border border-red/40 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide text-red hover:bg-red hover:text-paper disabled:opacity-50';

function useAdminAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: true } | { error: string }>) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if ('error' in res) setError(res.error);
      else router.refresh();
    });
  };
  return { pending, error, run };
}

export function DeleteListButton({ id, title }: { id: string; title: string }) {
  const { pending, error, run } = useAdminAction();
  return (
    <span className="inline-flex items-center gap-2">
      {error && <span className="font-mono text-[10px] text-red">{error}</span>}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          // One-step confirm is deliberate for v1 — this cascades entries + comments.
          if (window.confirm(`Delete “${title}”? Its entries, comments, and likes go with it. This cannot be undone.`)) {
            run(() => deleteList(id));
          }
        }}
        className={DANGER}
      >
        {pending ? 'Deleting…' : 'Delete list'}
      </button>
    </span>
  );
}

export function DeleteCommentButton({ id }: { id: string }) {
  const { pending, error, run } = useAdminAction();
  return (
    <span className="inline-flex items-center gap-2">
      {error && <span className="font-mono text-[10px] text-red">{error}</span>}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (window.confirm('Delete this comment for good?')) {
            run(() => deleteComment(id));
          }
        }}
        className={DANGER}
      >
        {pending ? 'Deleting…' : 'Delete'}
      </button>
    </span>
  );
}

export function ReviewButtons({ id }: { id: string }) {
  const { pending, error, run } = useAdminAction();
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {error && <span className="font-mono text-[10px] text-red">{error}</span>}
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => reviewSubmission(id, 'approved'))}
        className="press rounded-chip bg-green px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-paper disabled:opacity-50"
      >
        Approve
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => reviewSubmission(id, 'rejected'))}
        className="press rounded-chip border border-hairline px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide text-secondary hover:border-ink/40 hover:text-ink disabled:opacity-50"
      >
        Reject
      </button>
    </span>
  );
}
