/** Numeric formatting layer — every on-screen number routes through these. */

export const fmtInt = (n: number | null | undefined): string =>
  (Number.isFinite(n as number) ? (n as number) : 0).toLocaleString('en-US');

/** Zero-pad a position to the digit count of the list's max position (min 2). */
export function fmtPos(pos: number, max: number): string {
  const digits = Math.max(2, String(Math.max(max || 0, pos || 0)).length);
  return String(pos).padStart(digits, '0');
}

/** One decimal, rounded once; em dash for unrated. Never NaN/0.0/undefined. */
export const fmtRating = (v: number | null | undefined): string =>
  v ? (Math.round(v * 10) / 10).toFixed(1) : '—';

export const fmtCount = (n: number, word: string, plural?: string): string =>
  `${fmtInt(n)} ${n === 1 ? word : plural ?? word + 's'}`;

/** Render only plausible 4-digit years; otherwise omit entirely. */
export const fmtYear = (y: number | string | null | undefined): string =>
  /^\d{4}$/.test(String(y ?? '')) ? String(y) : '';

export function timeAgo(iso: string | Date): string {
  const d = Date.now() - new Date(iso).getTime();
  if (d < 60_000) return 'now';
  if (d < 3_600_000) return Math.floor(d / 60_000) + 'm';
  if (d < 86_400_000) return Math.floor(d / 3_600_000) + 'h';
  if (d < 30 * 86_400_000) return Math.floor(d / 86_400_000) + 'd';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function msToLen(ms: number | null | undefined): string {
  if (!ms) return '';
  const t = Math.round(ms / 1000);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}
