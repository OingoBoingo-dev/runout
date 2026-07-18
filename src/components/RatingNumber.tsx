'use client';

import { formatRatingAs } from '@/lib/format';
import { ratingTier, tierClasses } from '@/lib/rating';
import { useRatingDisplay } from '@/lib/rating-display';

/**
 * THE numeric rating renderer — every on-screen rating number goes through
 * here (formatting stays in lib/format) so metallic tiers AND the
 * stars-vs-tenths display preference apply uniformly: dazzling gold ≥ 4.5,
 * flat silver ≥ 4.0, bronze ≥ 3.5, ink otherwise ("black" per owner spec).
 * Unrated renders formatRatingAs's em dash in the caller's inherited color.
 *
 * Display mode (cycle 10): by default this follows the device preference
 * (localStorage['ordko-rating-display'] via useRatingDisplay) — 'stars'
 * renders 0–5 to one decimal, 'tenths' renders value × 2 + "/10"
 * (4.6 → "9.2/10"). Tiers key off the raw 0–5 value, so gold/silver/bronze
 * apply identically in both modes. SSR emits the 'stars' default and
 * hydration swaps the text only. Pass `outOf` only to FORCE a mode where
 * the preference must not apply (e.g. a future server-rendered OG image).
 */
export function RatingNumber({
  value,
  outOf,
  className,
}: {
  value: number | null;
  /** Force 'five' | 'ten'; omit to follow the user's rating-display preference. */
  outOf?: 'five' | 'ten';
  className?: string;
}) {
  const [pref] = useRatingDisplay();
  const mode = outOf ? (outOf === 'ten' ? 'tenths' : 'stars') : pref;
  const tier = ratingTier(value);
  const color = tierClasses(tier) ?? (tier === 'plain' ? 'text-ink' : null);
  return (
    <span className={[className, color].filter(Boolean).join(' ') || undefined}>
      {formatRatingAs(value, mode)}
    </span>
  );
}
