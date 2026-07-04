'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toggleFollow } from '@/app/actions/social';

export function FollowButton({
  userId,
  username,
  following,
}: {
  userId: string;
  username: string;
  following: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await toggleFollow({ userId });
          router.refresh();
        })
      }
      className={`rounded-chip px-4 py-2.5 font-mono text-xs uppercase tracking-wider disabled:opacity-50 ${
        following
          ? 'border border-cobalt text-cobalt'
          : 'bg-cobalt font-semibold text-paper hover:bg-cobalt/90'
      }`}
    >
      {following ? 'Following — click to unfollow' : `Follow @${username}`}
    </button>
  );
}
