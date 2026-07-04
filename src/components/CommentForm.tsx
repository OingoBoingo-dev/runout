'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { addComment } from '@/app/actions/social';

export function CommentForm({ listId }: { listId: string }) {
  const router = useRouter();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="glass flex max-w-2xl flex-col items-start gap-2.5 rounded-card p-3"
      onSubmit={e => {
        e.preventDefault();
        const body = ref.current?.value.trim() ?? '';
        if (!body) {
          setError('Write a comment first — the thread doesn’t take blanks.');
          return;
        }
        setError(null);
        startTransition(async () => {
          const res = await addComment({ listId, body });
          if ('error' in res) setError(res.error);
          else {
            if (ref.current) ref.current.value = '';
            router.refresh();
          }
        });
      }}
    >
      <textarea
        ref={ref}
        maxLength={500}
        placeholder="Say something about this list…"
        aria-label="Write a comment"
        className="min-h-[64px] w-full rounded-chip border border-hairline bg-ink/5 p-3 text-ink placeholder:text-secondary focus:border-cobalt focus:outline-none"
      />
      {error && <p className="font-mono text-xs text-red">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-chip border border-hairline px-4 py-2.5 font-mono text-xs uppercase tracking-wider hover:border-ink/40 disabled:opacity-50"
      >
        Post comment
      </button>
    </form>
  );
}
