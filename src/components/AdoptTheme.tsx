'use client';

import { useEffect } from 'react';
import { applyScheme, getScheme } from '@/lib/themes';

/**
 * While a profile page is mounted, the viewer adopts the visited collector's
 * FULL palette — all 9 vars: the 5 neutrals plus the 4 role hues that
 * yellow/cobalt/red/green alias — their room, their lighting (ambient
 * role-hue washes included; unlock thresholds gate SETTING a palette, never
 * seeing one). Stored legacy scheme ids resolve through LEGACY_MAP inside
 * getScheme, so a profile saved before the cycle-11 overhaul still adopts
 * cleanly. On unmount (or when navigating between profiles) the viewer's own
 * palette is restored from localStorage (legacy ids resolve the same way),
 * falling back to stock paper. Renders nothing.
 */
export function AdoptTheme({ scheme }: { scheme: string | null }) {
  useEffect(() => {
    const visited = getScheme(scheme);
    if (!visited) return; // unknown/absent palette → leave the viewer's theme alone
    applyScheme(visited);
    return () => {
      let own: string | null = null;
      try {
        own = localStorage.getItem('ordko-scheme');
      } catch {}
      applyScheme(getScheme(own)); // invalid/null → clears back to stock
    };
  }, [scheme]);
  return null;
}
