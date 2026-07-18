/**
 * Pure cover-URL sizing helpers — client-safe (no admin/queue imports).
 *
 * Derives the documented Cover Art Archive (-250/-500/-1200) and iTunes
 * (NxNbb) thumbnail variants from the SAME stored catalog_items.cover_url.
 * Never constructs art URLs from scratch — resolution stays server-side in
 * lib/covers.ts.
 */

export type CoverSize = 250 | 500 | 1200;

/** CAA front/back URLs accept -250/-500/-1200 thumbnail suffixes. */
const CAA_RE = /(coverartarchive\.org\/\S*\/(?:front|back))(?:-\d+)?$/i;

/** iTunes artwork URLs embed the pixel size as an `NxNbb` path segment. */
const ITUNES_RE = /\/(\d+x\d+)bb(\.(?:jpe?g|png|webp))?$/i;

export function coverThumb(url: string, size: CoverSize): string {
  if (CAA_RE.test(url)) return url.replace(CAA_RE, `$1-${size}`);
  if (ITUNES_RE.test(url)) {
    // iTunes art tops out around 600px — never over-fetch past it.
    const px = size === 250 ? '250x250' : '600x600';
    return url.replace(ITUNES_RE, `/${px}bb$2`);
  }
  return url; // unknown shape: leave the stored URL untouched
}

/**
 * All documented size candidates for a stored cover URL, as an <img srcSet>
 * string — lets the browser pick per viewport/DPR (fixes both the mobile
 * over-fetch and high-DPR softness without per-site size guessing).
 * Unknown URL shapes get no srcset (single-src render).
 */
export function coverSrcSet(url: string): string | undefined {
  if (CAA_RE.test(url)) {
    return ([250, 500, 1200] as const)
      .map(s => `${url.replace(CAA_RE, `$1-${s}`)} ${s}w`)
      .join(', ');
  }
  if (ITUNES_RE.test(url)) {
    return [250, 600]
      .map(s => `${url.replace(ITUNES_RE, `/${s}x${s}bb$2`)} ${s}w`)
      .join(', ');
  }
  return undefined;
}
