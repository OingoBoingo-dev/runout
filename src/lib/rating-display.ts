'use client';

import { useSyncExternalStore } from 'react';

/**
 * Device-local rating-display preference (cycle 10) — schema-free by design:
 * 'stars' shows the classic 0–5 one-decimal number, 'tenths' shows N/10
 * (value × 2). Lives ONLY in localStorage['ordko-rating-display']; no
 * profiles column, no migration, default 'stars'.
 *
 * SSR-safe: the server snapshot is always 'stars', so server HTML and
 * hydration match; right after hydration React reads the real localStorage
 * value and re-renders. The swap is text-only ("4.6" → "9.2/10"), so there
 * is no flash concern.
 *
 * Sync: one MODULE-LEVEL window subscription fans out to every mounted
 * consumer — the custom in-tab event covers same-tab writes (the native
 * 'storage' event never fires in the tab that wrote) and 'storage' covers
 * other tabs. The window listeners are wired once and live for the page
 * lifetime, which is correct for a singleton preference.
 */

export type RatingDisplay = 'stars' | 'tenths';

const KEY = 'ordko-rating-display';
const EVENT = 'ordko:rating-display';

function snapshot(): RatingDisplay {
  try {
    return localStorage.getItem(KEY) === 'tenths' ? 'tenths' : 'stars';
  } catch {
    return 'stars';
  }
}

const serverSnapshot = (): RatingDisplay => 'stars';

const subscribers = new Set<() => void>();
let wired = false;

function notify() {
  for (const cb of subscribers) cb();
}

function subscribe(cb: () => void): () => void {
  if (!wired) {
    wired = true;
    window.addEventListener(EVENT, notify);
    window.addEventListener('storage', e => {
      // key === null means localStorage.clear() — that resets us too.
      if (e.key === null || e.key === KEY) notify();
    });
  }
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

/** Persist the preference and ping every mounted consumer in this tab. */
export function setRatingDisplay(v: RatingDisplay): void {
  try {
    localStorage.setItem(KEY, v);
  } catch {
    // Private-mode storage failure: the in-tab event below still updates the
    // UI for this visit; the choice just won't survive a reload.
  }
  window.dispatchEvent(new Event(EVENT));
}

/** `[mode, setMode]` — every consumer re-renders on any set, in any tab. */
export function useRatingDisplay(): [RatingDisplay, (v: RatingDisplay) => void] {
  const mode = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  return [mode, setRatingDisplay];
}
