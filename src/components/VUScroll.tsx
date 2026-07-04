'use client';

import { usePathname } from 'next/navigation';
import { useMemo, useSyncExternalStore } from 'react';

/**
 * VU scroll indicator (aesthetic-synthesis): a waveform of small bars under
 * the top bar. Heights are seeded from the current path — every page, list
 * and record gets its own "waveform" impression — and bars light up cobalt
 * as you scroll through the page.
 */
const BARS = 30;

function hashStr(s: string): number {
  let h = 2166136261;
  for (const c of s) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Seeded waveform heights — pure module function (PRNG needs mutation). */
function waveHeights(key: string): number[] {
  let h = hashStr(key);
  let prev = 8;
  return Array.from({ length: BARS }, () => {
    h = (Math.imul(h, 1103515245) + 12345) >>> 0;
    const r = ((h >>> 16) & 255) / 255;
    const v = prev * 0.5 + (3 + r * 12) * 0.5; // smoothed — reads as a waveform
    prev = v;
    return Math.round(v * 10) / 10;
  });
}

function subscribeScroll(cb: () => void) {
  window.addEventListener('scroll', cb, { passive: true });
  window.addEventListener('resize', cb);
  return () => {
    window.removeEventListener('scroll', cb);
    window.removeEventListener('resize', cb);
  };
}

function litSnapshot(): number {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const f = max > 0 ? window.scrollY / max : 0;
  return f > 0 ? Math.max(1, Math.round(f * BARS)) : 0;
}

export function VUScroll() {
  const pathname = usePathname();
  const heights = useMemo(() => waveHeights(pathname || '/'), [pathname]);
  const lit = useSyncExternalStore(subscribeScroll, litSnapshot, () => 0);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-[calc(56px+env(safe-area-inset-top))] z-40 flex h-4 items-end gap-[3px] bg-gradient-to-b from-paper via-paper/60 to-transparent px-4 pb-1"
    >
      {heights.map((h, i) => (
        <i
          key={i}
          className={`flex-1 rounded-[2px] transition-[background,height] duration-500 [transition-timing-function:var(--ease-blanket)] ${
            i < lit ? 'bg-cobalt shadow-[0_0_6px_rgba(44,75,223,0.4)]' : 'bg-ink/10'
          }`}
          style={{ height: `${h}px` }}
        />
      ))}
    </div>
  );
}
