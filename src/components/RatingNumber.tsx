import { formatRating } from '@/lib/format';
import { ratingTier, tierClasses } from '@/lib/rating';

/**
 * THE numeric rating renderer — every on-screen rating number goes through
 * here (formatting stays in lib/format) so metallic tiers apply uniformly:
 * dazzling gold ≥ 4.5, flat silver ≥ 4.0, bronze ≥ 3.5, ink otherwise
 * ("black" per owner spec). Unrated renders formatRating's em dash in the
 * caller's inherited color.
 *
 * `outOf` exists for the coming stars-vs-tenths display toggle: 'ten'
 * renders value×2 to one decimal (4.6 → "9.2"). This cycle every site
 * passes the default 'five'.
 */
export function RatingNumber({
  value,
  outOf = 'five',
  className,
}: {
  value: number | null;
  outOf?: 'five' | 'ten';
  className?: string;
}) {
  const tier = ratingTier(value);
  const color = tierClasses(tier) ?? (tier === 'plain' ? 'text-ink' : null);
  const display = formatRating(outOf === 'ten' && value ? value * 2 : value);
  return <span className={[className, color].filter(Boolean).join(' ') || undefined}>{display}</span>;
}
