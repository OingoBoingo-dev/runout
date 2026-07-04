'use client';

import { useState } from 'react';
import { placeholderCover } from '@/lib/placeholder';

/**
 * 1:1 cover in a fixed aspect box — no layout shift, shimmer skeleton while
 * loading, monogram placeholder for nulls/failures. Clients only ever render
 * catalog_items.cover_url; resolution happened server-side.
 */
export function Cover({
  src,
  title,
  artist,
  className = '',
  rounded = 'rounded-chip',
}: {
  src: string | null;
  title: string;
  artist: string;
  className?: string;
  rounded?: string;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const url = !src || failed ? placeholderCover(title, artist) : src;
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
        loading="lazy"
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
