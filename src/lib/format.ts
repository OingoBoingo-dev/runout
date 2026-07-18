/** Numeric formatting layer — every number on screen routes through these. */

/** Zero-pad a position to the digit count of the list's max position (min 2). */
export function formatPosition(pos: number, maxPos: number): string {
  const digits = Math.max(2, String(Math.max(maxPos || 0, pos || 0)).length);
  return String(pos).padStart(digits, '0');
}

/** Locale separators for scores and any count that can reach 1000+. */
export const formatScore = (n: number | null | undefined): string =>
  (Number.isFinite(n as number) ? (n as number) : 0).toLocaleString('en-US');

/** Exactly one decimal, rounded once; em dash for unrated. Never NaN/0.0/undefined. */
export const formatRating = (v: number | null | undefined): string =>
  v ? (Math.round(v * 10) / 10).toFixed(1) : '—';

/**
 * Mode-aware rating text — ALL numeric rating copy flows through here:
 * 'stars' = formatRating's 0–5 one decimal; 'tenths' = (value × 2) rounded
 * once to one decimal + "/10" (4.6 → "9.2/10"). Em dash for unrated in both.
 */
export const formatRatingAs = (v: number | null | undefined, mode: 'stars' | 'tenths'): string =>
  mode === 'tenths' && v ? (Math.round(v * 20) / 10).toFixed(1) + '/10' : formatRating(v);

/** `1 list`, `2 lists`, `1 like` — with an irregular-plural escape hatch. */
export const plural = (n: number, noun: string, pluralNoun?: string): string =>
  `${formatScore(n)} ${n === 1 ? noun : pluralNoun ?? noun + 's'}`;

/** `now`, `4m`, `2h`, `3d`, then a short date. */
export function relativeTime(ts: string | Date): string {
  const d = Date.now() - new Date(ts).getTime();
  if (d < 60_000) return 'now';
  if (d < 3_600_000) return Math.floor(d / 60_000) + 'm';
  if (d < 86_400_000) return Math.floor(d / 3_600_000) + 'h';
  if (d < 30 * 86_400_000) return Math.floor(d / 86_400_000) + 'd';
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Render only plausible 4-digit years; otherwise omit entirely. */
export const formatYear = (y: number | string | null | undefined): string =>
  /^\d{4}$/.test(String(y ?? '')) ? String(y) : '';

/** m:ss track lengths; empty when unknown. */
export function formatLength(ms: number | null | undefined): string {
  if (!ms) return '';
  const t = Math.round(ms / 1000);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

/* Back-compat aliases (pre-rename call sites). */
export const fmtPos = formatPosition;
export const fmtInt = formatScore;
export const fmtRating = formatRating;
export const fmtCount = plural;
export const timeAgo = relativeTime;
export const fmtYear = formatYear;
export const msToLen = formatLength;
