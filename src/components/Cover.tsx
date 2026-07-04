'use client';

import { useState } from 'react';
import { placeholderCover } from '@/lib/placeholder';

/**
 * 1:1 cover image with the designed monogram placeholder on 404.
 * Plain <img>: covers are hotlinked from Cover Art Archive per spec.
 */
export function Cover({
  src,
  title,
  artist,
  className = '',
}: {
  src: string | null;
  title: string;
  artist: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const url = !src || failed ? placeholderCover(title, artist) : src;
  return (
    <span className={`relative block aspect-square overflow-hidden rounded-chip bg-[#242220] ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className="absolute inset-0 h-full w-full object-cover"
      />
    </span>
  );
}
