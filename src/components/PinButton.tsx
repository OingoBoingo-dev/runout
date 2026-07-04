'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { togglePin } from '@/app/actions/social';

export function PinButton({ itemMbid, pinned }: { itemMbid: string; pinned: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await togglePin({ itemMbid });
          router.refresh();
        })
      }
      className={`rounded-chip border px-3.5 py-2.5 font-mono text-[11px] uppercase tracking-wide disabled:opacity-50 ${
        pinned ? 'border-accent text-accent' : 'border-ink/20 hover:border-ink'
      }`}
    >
      {pinned ? 'Pinned to profile' : 'Pin to profile'}
    </button>
  );
}
