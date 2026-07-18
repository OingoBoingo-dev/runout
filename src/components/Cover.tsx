'use client';

import { useState } from 'react';
import { coverThumb, type CoverSize } from '@/lib/cover-url';
import { placeholderCover } from '@/lib/placeholder';

/**
 * 1:1 cover in a fixed aspect box — no layout shift, shimmer skeleton while
 * loading, monogram placeholder for nulls/failures. Clients only ever render
 * catalog_items.cover_url; resolution happened server-side. The `size` prop
 * requests the CAA/iTunes thumbnail variant matched to the render slot so a
 * 40px tile never downloads a 500px file.
 */
export function Cover({
  src,
  title,
  artist,
  className = '',
  rounded = 'rounded-chip',
  size = 250,
  priority = false,
}: {
  src: string | null;
  title: string;
  artist: string;
  className?: string;
  rounded?: string;
  /** Thumbnail variant: 250 for small tiles/rows, 500 for grid cards + hero. */
  size?: CoverSize;
  /** Above-the-fold covers load eagerly at high fetch priority; rest stay lazy. */
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const url = !src || failed ? placeholderCover(title, artist) : coverThumb(src, size);
  return (
    <span
      className={`relative block aspect-square overflow-hidden bg-ink/5 ${
        loaded ? '' : 'shimmer'
      } ${rounded} ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => {
          setFailed(true);
          setLoaded(true);
        }}
        className="absolute inset-0 h-full w-full object-cover"
      />
    </span>
  );
}
