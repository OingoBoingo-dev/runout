'use client';

import { useEffect } from 'react';
import { applyScheme, getScheme } from '@/lib/themes';

/**
 * While a profile page is mounted, the viewer adopts the visited collector's
 * scheme — their room, their lighting (ambient washes included; unlock
 * thresholds gate SETTING a scheme, never seeing one). On unmount (or when
 * navigating between profiles) the viewer's own scheme is restored from
 * localStorage, falling back to stock paper. Renders nothing.
 */
export function AdoptTheme({ scheme }: { scheme: string | null }) {
  useEffect(() => {
    const visited = getScheme(scheme);
    if (!visited) return; // unknown/absent scheme → leave the viewer's theme alone
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
