'use client';

import { useEffect, useState } from 'react';

/**
 * Copy-link control for shareable pages. Cobalt-accented because
 * cobalt = interactive in the pressing-plant palette. Pass a path
 * (e.g. `/list/abc`) and the absolute URL is built client-side, or
 * pass a full URL directly.
 */
export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  const onClick = async () => {
    const absolute =
      url.startsWith('http') || typeof window === 'undefined'
        ? url
        : `${window.location.origin}${url}`;
    try {
      await navigator.clipboard.writeText(absolute);
      setCopied(true);
    } catch {
      // clipboard blocked (e.g. insecure context) — leave state unchanged
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="press rounded-chip border border-hairline px-4 py-2.5 font-mono text-xs uppercase tracking-wider text-cobalt hover:border-cobalt/40"
    >
      <span aria-live="polite">{copied ? 'Copied' : 'Copy link'}</span>
    </button>
  );
}
