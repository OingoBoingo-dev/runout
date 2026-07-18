'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { rateItem } from '@/app/actions/social';
import { Stars } from '@/components/Stars';

/**
 * Interactive 0.5–5 star rating: ten half-star hit targets over the row.
 *
 * Rating-display preference (cycle 10): the INPUT affordance stays stars in
 * both modes — you always rate by tapping half-star targets. The numeric
 * readout that swaps to N/10 in 'tenths' mode is the RatingNumber the item
 * page renders beside this control; RateControl itself prints no number, so
 * it needs no hook.
 */
export function RateControl({ itemMbid, initial }: { itemMbid: string; initial: number }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const rate = (v: number) => {
    setError(null);
    setValue(v);
    startTransition(async () => {
      const res = await rateItem({ itemMbid, value: v });
      if ('error' in res) {
        setError(res.error);
        setValue(initial);
      } else {
        router.refresh();
      }
    });
  };

  return (
    <span className="inline-flex items-center gap-3">
      <span className={`relative inline-flex ${pending ? 'opacity-60' : ''}`}>
        {/* The value display tiers via Stars (gold dazzle / silver / bronze
            once a rating is set; cobalt while unrated) — the half-star hit
            targets below keep their interactive-cobalt hover feedback. */}
        <Stars value={value} size={26} />
        <span className="absolute -inset-y-2 inset-x-0 grid grid-cols-10">
          {Array.from({ length: 10 }, (_, i) => {
            const v = (i + 1) / 2;
            return (
              <button
                key={v}
                type="button"
                onClick={() => rate(v)}
                aria-label={`Rate ${v} star${v === 1 ? '' : 's'}`}
                title={String(v)}
                className="rounded-[2px] hover:shadow-[inset_0_-2px_0_var(--color-cobalt)]"
              />
            );
          })}
        </span>
      </span>
      {error && <span className="font-mono text-xs text-red">{error}</span>}
    </span>
  );
}
