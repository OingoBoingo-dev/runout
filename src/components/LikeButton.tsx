'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toggleLike } from '@/app/actions/social';
import { fmtInt } from '@/lib/format';

export function LikeButton({
  targetType,
  targetId,
  liked,
  count,
  small = false,
  disabled = false,
}: {
  targetType: 'list' | 'comment';
  targetId: string;
  liked: boolean;
  count: number;
  small?: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const base = small
    ? 'rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-wide'
    : 'rounded-chip border px-4 py-2.5 font-mono text-xs uppercase tracking-wider';
  const tone = liked
    ? 'border-accent text-accent'
    : 'border-paper/20 text-muted hover:border-paper hover:text-paper';
  return (
    <button
      type="button"
      disabled={pending || disabled}
      title={disabled ? 'Sign in to like' : undefined}
      onClick={() =>
        startTransition(async () => {
          await toggleLike({ targetType, targetId });
          router.refresh();
        })
      }
      className={`${base} ${tone} disabled:opacity-50`}
    >
      {liked ? 'Liked' : 'Like'} · {fmtInt(count)}
    </button>
  );
}
