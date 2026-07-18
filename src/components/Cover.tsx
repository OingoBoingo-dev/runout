'use client';

import { useState } from 'react';
import { coverSrcSet, coverThumb, type CoverSize } from '@/lib/cover-url';
import { placeholderCover } from '@/lib/placeholder';

/**
 * 1:1 cover in a fixed aspect box — no layout shift, shimmer skeleton while
 * loading, monogram placeholder for nulls/failures. Clients only ever render
 * catalog_items.cover_url; resolution happened server-side. The `size` prop
 * requests the CAA/iTunes thumbnail variant matched to the render slot so a
 * 40px tile never downloads a 500px file; `sizes` (when the slot is
 * responsive) lets the browser pick the right variant per viewport/DPR from
 * the srcset instead of trusting our single guess.
 *
 * Failure ladder: derived thumb variant errors → retry the stored original
 * (size variants can 404 independently of the verified original) → monogram.
 */
export function Cover({
  src,
  title,
  artist,
  className = '',
  rounded = 'rounded-chip',
  size = 250,
  sizes,
  priority = false,
}: {
  src: string | null;
  title: string;
  artist: string;
  className?: string;
  rounded?: string;
  /** Thumbnail variant: 250 for small tiles/rows, 500 for grid cards + hero. */
  size?: CoverSize;
  /** CSS `sizes` for responsive slots (e.g. "(min-width:640px) 210px, 19vw"). Defaults to the fixed slot size. */
  sizes?: string;
  /** Above-the-fold covers load eagerly at high fetch priority; rest stay lazy. */
  priority?: boolean;
}) {
  // 0 = derived thumb, 1 = stored original (thumb variant 404ed), 2 = placeholder.
  const [fallback, setFallback] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const thumb = src ? coverThumb(src, size) : null;
  const url =
    !src || fallback >= 2 ? placeholderCover(title, artist) : fallback === 1 ? src : thumb!;
  const srcSet = src && fallback === 0 ? coverSrcSet(src) : undefined;
  return (
    <span
      className={`relative block aspect-square overflow-hidden bg-ink/5 ${
        loaded ? '' : 'shimmer'
      } ${rounded} ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        srcSet={srcSet}
        sizes={srcSet ? (sizes ?? `${size}px`) : undefined}
        alt=""
        width={size}
        height={size}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => {
          // Derived variant failed but the stored original was server-verified —
          // try it before giving up; only the original's failure means monogram.
          setFallback(f => (f === 0 && src && thumb !== src ? 1 : 2));
          if (fallback > 0 || !src || thumb === src) setLoaded(true);
        }}
        className="absolute inset-0 h-full w-full object-cover"
      />
    </span>
  );
}
