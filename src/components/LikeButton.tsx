'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toggleLike } from '@/app/actions/social';
import { formatScore } from '@/lib/format';

const Heart = ({ filled, size = 14 }: { filled: boolean; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden
  >
    <path d="M12 20.3s-6.8-4.4-9.1-8.4C1.4 9.2 3.2 5.8 6.4 5.8c2 0 3.3 1.1 4.2 2.4l1.4 2 1.4-2c.9-1.3 2.2-2.4 4.2-2.4 3.2 0 5 3.4 3.5 6.1-2.3 4-9.1 8.4-9.1 8.4z" />
  </svg>
);

/** Likes are the emotional action — red hearts, per the two-color rule. */
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
    ? 'rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide'
    : 'rounded-chip border px-4 py-2.5 font-mono text-xs uppercase tracking-wider';
  const tone = liked
    ? 'border-red/40 text-red'
    : 'border-hairline text-secondary hover:border-red/40 hover:text-red';
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
      className={`press inline-flex items-center gap-1.5 ${base} ${tone} disabled:opacity-50`}
    >
      <Heart filled={liked} size={small ? 12 : 14} />
      {liked ? 'Liked' : 'Like'} · {formatScore(count)}
    </button>
  );
}
