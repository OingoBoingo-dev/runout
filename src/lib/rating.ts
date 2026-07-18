/**
 * Metallic rating tiers — the single source of tier truth (cycle 9).
 *
 * High ratings render in metals instead of ink: dazzling gold for 4.5–5,
 * flat silver for 4–4.4, bronze for 3.5–3.9, everything else plain ink.
 * Metals are a sanctioned decorative treatment per owner spec — they sit
 * outside the four semantic primaries (yellow/cobalt/red/green) and never
 * re-tint with vinyl schemes.
 */

export type RatingTier = 'gold' | 'silver' | 'bronze' | 'plain';

/**
 * Tier for a stored 0.5–5.0 rating or a community average.
 * null/undefined/0 → null (unrated). The value is rounded once to one
 * decimal (exactly like formatRating) before thresholding, so an average
 * that DISPLAYS as "4.5" also tiers gold — a no-op for stored half-steps.
 * Gold ≥ 4.5 (9–10/10) · silver ≥ 4.0 (8–8.9) · bronze ≥ 3.5 (7–7.9).
 */
export function ratingTier(value: number | null | undefined): RatingTier | null {
  if (!value) return null;
  const v = Math.round(value * 10) / 10;
  if (v >= 4.5) return 'gold';
  if (v >= 4) return 'silver';
  if (v >= 3.5) return 'bronze';
  return 'plain';
}

/**
 * Canonical metal hexes — picked to hold contrast on both paper and the dark
 * vinyl schemes. Components color exclusively via the .tier-* classes in
 * globals.css (which mirror these values); this record is the constant of
 * record for consumers that can't use CSS classes (e.g. future OG images).
 */
export const TIER_COLORS: Record<Exclude<RatingTier, 'plain'>, string> = {
  gold: '#C9971E',
  silver: '#8E959C',
  bronze: '#A9722E',
};

/**
 * Class string for a metal tier — gold carries the dazzle, silver/bronze are
 * flat. Plain/unrated → null (callers keep their own ink/cobalt fallback).
 */
export function tierClasses(tier: RatingTier | null): string | null {
  if (tier === 'gold') return 'tier-gold tier-dazzle';
  if (tier === 'silver') return 'tier-silver';
  if (tier === 'bronze') return 'tier-bronze';
  return null;
}
