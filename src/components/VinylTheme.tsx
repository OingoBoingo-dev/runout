'use client';

/* eslint-disable react-hooks/set-state-in-effect, react-hooks/refs --
   pointer-drag color picker: refs are only read inside pointer event handlers,
   and the persisted tint must hydrate after mount (localStorage is client-only). */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Vinyl theme picker (aesthetic-synthesis, adapted to Pressing-Plant rules):
 * a spinning record in the top bar opens a glass sheet with a hue wheel
 * pressed as vinyl plus a lightness slider. The chosen hue re-tints the
 * NEUTRAL system — paper ground, card surface, ink, secondary, hairlines,
 * and therefore the glass chrome — while the four primaries keep their
 * semantic jobs (yellow rank / cobalt interactive / red emotion / green
 * confirmation). Persists locally; Reset restores the stock paper.
 */

interface Tint {
  h: number;
  s: number; // wheel radius 0-100
  l: number; // paper lightness
}

const STORAGE_KEY = 'ordko-tint';
const DEFAULT_L = 96;

function roles(t: Tint) {
  const gs = Math.min(45, 8 + t.s * 0.4); // ground saturation, capped so covers still lead
  const l = Math.max(88, Math.min(97.5, t.l));
  return {
    '--color-paper': `hsl(${t.h} ${gs}% ${l}%)`,
    '--color-card': `hsl(${t.h} ${Math.min(30, gs * 0.7)}% ${Math.min(99, l + 3)}%)`,
    '--color-ink': `hsl(${t.h} 22% 7%)`,
    '--color-secondary': `hsl(${t.h} 10% 44%)`,
    '--color-hairline': `hsl(${t.h} 22% 7% / 0.08)`,
  } as const;
}

function applyTint(t: Tint | null) {
  const r = document.documentElement.style;
  const keys = ['--color-paper', '--color-card', '--color-ink', '--color-secondary', '--color-hairline'];
  if (!t) {
    keys.forEach(k => r.removeProperty(k));
    return;
  }
  const set = roles(t);
  (Object.keys(set) as (keyof typeof set)[]).forEach(k => r.setProperty(k, set[k]));
}

export function VinylTheme() {
  const [open, setOpen] = useState(false);
  const [tint, setTint] = useState<Tint | null>(null);
  const wheelRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const t = JSON.parse(raw) as Tint;
        setTint(t);
        applyTint(t);
      }
    } catch {}
  }, []);

  const update = useCallback((t: Tint | null) => {
    setTint(t);
    applyTint(t);
    try {
      if (t) localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, []);

  const fromWheel = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const el = wheelRef.current;
      if (!el) return;
      const b = el.getBoundingClientRect();
      const R = b.width / 2;
      const dx = e.clientX - b.left - R;
      const dy = e.clientY - b.top - R;
      const h = (Math.atan2(dy, dx) * 180) / Math.PI + 90; // 0° at top, matches conic
      const s = Math.min(1, Math.hypot(dx, dy) / (R - 14)) * 100;
      update({ h: (h + 360) % 360, s, l: tint?.l ?? DEFAULT_L });
    },
    [tint, update],
  );

  const fromSlider = useCallback(
    (e: { clientY: number }) => {
      const el = sliderRef.current;
      if (!el) return;
      const b = el.getBoundingClientRect();
      const l = Math.max(88, Math.min(97.5, (1 - (e.clientY - b.top) / b.height) * 100));
      update({ h: tint?.h ?? 43, s: tint?.s ?? 30, l });
    },
    [tint, update],
  );

  const drag = (fn: (e: { clientX: number; clientY: number }) => void) => ({
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      fn(e);
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.buttons > 0) fn(e);
    },
  });

  const swatches = tint ? roles(tint) : null;

  return (
    <>
      <button
        type="button"
        aria-label="Theme — pick a paper tint"
        onClick={() => setOpen(true)}
        className="press relative h-7 w-7 flex-none rounded-full motion-safe:animate-[vinylspin_5s_linear_infinite]"
        style={{
          background:
            'repeating-radial-gradient(circle at center, rgba(22,21,15,.12) 0 1px, transparent 1px 3.5px), conic-gradient(#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)',
        }}
      >
        <span
          aria-hidden
          className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-paper shadow-[0_0_0_2px_var(--color-ink)]"
        />
      </button>

      {/* Portal to <body>: the glass nav's backdrop-filter creates a containing
          block that would otherwise trap this fixed sheet inside the 56px bar. */}
      {open &&
        createPortal(
          <>
          <button
            aria-label="Close theme picker"
            className="fixed inset-0 z-[60] cursor-default bg-ink/30"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-label="Theme picker"
            className="glass fixed bottom-[calc(12px+env(safe-area-inset-bottom))] left-1/2 z-[70] w-[min(94vw,420px)] -translate-x-1/2 rounded-sheet p-5"
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="font-display text-base">Paper tint</p>
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-secondary">
                  {tint
                    ? `HSL ${Math.round(tint.h)} · ${Math.round(tint.s)} · ${Math.round(tint.l)}`
                    : 'Stock paper — pressing-plant primaries stay fixed'}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => update(null)}
                  className="press rounded-full border border-hairline px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide text-secondary hover:text-ink"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="press rounded-full border border-hairline px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide"
                >
                  Done
                </button>
              </div>
            </div>

            {swatches && (
              <div className="mb-4 flex gap-2">
                {(
                  [
                    ['--color-paper', 'paper'],
                    ['--color-card', 'card'],
                    ['--color-secondary', 'muted'],
                    ['--color-ink', 'ink'],
                  ] as const
                ).map(([k, name]) => (
                  <span key={k} className="flex-1 text-center">
                    <span
                      className="block h-7 rounded-chip border border-hairline"
                      style={{ background: swatches[k] }}
                    />
                    <span className="mt-1 block font-mono text-[8px] uppercase tracking-wide text-secondary">
                      {name}
                    </span>
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center justify-center gap-5">
              <div
                ref={wheelRef}
                {...drag(fromWheel)}
                className="relative h-[200px] w-[200px] flex-none cursor-crosshair touch-none rounded-full shadow-[0_10px_30px_rgba(22,21,15,0.3)]"
                style={{
                  background:
                    'repeating-radial-gradient(circle at center, rgba(0,0,0,.2) 0 1.5px, rgba(0,0,0,0) 1.5px 5px), radial-gradient(circle closest-side, #999 0, rgba(153,153,153,.6) 22%, rgba(153,153,153,0) 72%), conic-gradient(#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)',
                }}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full shadow-[0_0_0_5px_rgba(22,21,15,0.5)]"
                  style={{ background: 'var(--color-paper)' }}
                >
                  <span className="font-display text-[8px] tracking-[0.14em] text-ink/70">ORDKO</span>
                  <span className="absolute h-2 w-2 rounded-full bg-ink" />
                </span>
                {tint && (
                  <span
                    aria-hidden
                    className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[2.5px] border-white shadow-[0_0_0_2px_rgba(0,0,0,0.55)]"
                    style={{
                      left: 100 + (tint.s / 100) * 86 * Math.cos(((tint.h - 90) * Math.PI) / 180),
                      top: 100 + (tint.s / 100) * 86 * Math.sin(((tint.h - 90) * Math.PI) / 180),
                    }}
                  />
                )}
              </div>
              <div
                ref={sliderRef}
                {...drag(fromSlider)}
                className="relative h-[200px] w-7 flex-none cursor-ns-resize touch-none rounded-chip border border-hairline"
                style={{ background: 'linear-gradient(#fff, #ddd 60%, #bbb)' }}
                aria-label="Paper lightness"
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute -inset-x-1 h-[5px] -translate-y-1/2 rounded-[3px] border border-ink/60 bg-white"
                  style={{ top: `${((97.5 - (tint?.l ?? DEFAULT_L)) / 9.5) * 100}%` }}
                />
              </div>
            </div>
            <p className="mt-4 font-mono text-[10px] leading-relaxed text-secondary">
              Tints the paper, surfaces and hairlines. Yellow, cobalt, red and green keep their
              jobs — color means something here.
            </p>
          </div>
          </>,
          document.body,
        )}
    </>
  );
}
