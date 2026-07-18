'use client';

/* eslint-disable react-hooks/set-state-in-effect --
   the persisted palette must hydrate after mount (localStorage is client-only)
   and unlock data loads lazily when the sheet opens. */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getThemeAccess, saveThemeScheme } from '@/app/actions/profile';
import { fmtInt } from '@/lib/format';
import { applyScheme, getScheme, SCHEMES, type Palette } from '@/lib/themes';

/**
 * Vinyl palette picker (cycle 11 overhaul): a spinning record in the top bar
 * opens a glass sheet with 12 curated palettes. A palette re-colors the WHOLE
 * page — the 5 neutrals (paper, card, ink, secondary, hairline — and
 * therefore the glass chrome) plus the 4 functional role hues (rank /
 * interactive / emotion / confirm) that the legacy yellow/cobalt/red/green
 * tokens alias. Each tile previews as its paper ground carrying the four
 * role dots, so distinctness reads at a glance. Persists locally always;
 * syncs to profiles.theme_scheme when signed in (tolerating the pending
 * migration). Retired scheme ids resolve through LEGACY_MAP inside
 * getScheme. The last four palettes are ambient role-hue washes that unlock
 * at 25/50/75/100 contributions.
 *
 * FROZEN CONTRACT (cycle 10 — the palette-overhaul cycle MUST preserve this
 * prop shape): `trigger?: 'record' | 'button'`.
 *   - 'record' (default): the spinning-disc nav trigger, byte-for-byte
 *     today's rendering — both Nav.tsx mounts pass nothing and change zero.
 *   - 'button': a full-width labeled Settings control ("Scheme" / current
 *     scheme name) used by SettingsForm's Color palette section.
 * Both triggers open the SAME sheet. Rebuild the picker internals freely;
 * keep both trigger renderings and this prop shape working.
 */

const STORAGE_KEY = 'ordko-scheme';
const LEGACY_KEY = 'ordko-tint'; // pre-scheme hue-wheel value — ignored, removed on first save

interface Access {
  contributions: number;
  savedScheme: string | null;
}

export function VinylTheme({ trigger = 'record' }: { trigger?: 'record' | 'button' }) {
  const [open, setOpen] = useState(false);
  const [schemeId, setSchemeId] = useState<string | null>(null);
  const [access, setAccess] = useState<Access | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // Hydrate the persisted palette (localStorage is client-only). A stored
  // legacy id resolves through LEGACY_MAP; normalize storage to the new id.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const s = getScheme(stored);
      if (s) {
        setSchemeId(s.id);
        applyScheme(s);
        if (stored !== s.id) localStorage.setItem(STORAGE_KEY, s.id);
      }
    } catch {}
  }, []);

  // Lazily fetch unlock progress + account palette when the sheet first opens.
  useEffect(() => {
    if (!open || access) return;
    let alive = true;
    getThemeAccess()
      .then(a => {
        if (!alive) return;
        setAccess(a);
        // Cross-device: adopt the account palette only if this device hasn't
        // picked one of its own. (The stored value may be a legacy id.)
        try {
          if (a.savedScheme && !localStorage.getItem(STORAGE_KEY)) {
            const s = getScheme(a.savedScheme);
            if (s) {
              setSchemeId(s.id);
              applyScheme(s);
              localStorage.setItem(STORAGE_KEY, s.id);
            }
          }
        } catch {}
      })
      .catch(() => {
        if (alive) setAccess({ contributions: 0, savedScheme: null });
      });
    return () => {
      alive = false;
    };
  }, [open, access]);

  const select = (id: string | null) => {
    setNote(null);
    setSchemeId(id);
    applyScheme(getScheme(id));
    try {
      localStorage.removeItem(LEGACY_KEY);
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {}
    // Fire-and-forget sync; signed-out just means local-only theming.
    saveThemeScheme(id)
      .then(res => {
        if ('error' in res && res.error === 'theme sync pending migration')
          setNote('Saved on this device — account sync arrives with the next migration.');
      })
      .catch(() => {});
  };

  const choose = (p: Palette) => {
    if (p.unlockAt && (access?.contributions ?? 0) < p.unlockAt) {
      setNote(
        `“${p.name}” unlocks at ${fmtInt(p.unlockAt)} contributions (published lists + ratings + comments) — you're at ${fmtInt(access?.contributions ?? 0)}.`,
      );
      return;
    }
    select(p.id);
  };

  const current = getScheme(schemeId);

  return (
    <>
      {trigger === 'record' ? (
        <button
          type="button"
          aria-label="Theme — pick a scheme"
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
      ) : (
        /* Settings-aesthetic trigger: label left, live palette name right.
           SSR shows "Stock paper"; the hydrate effect above syncs the name. */
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
          className="press w-full rounded-chip border border-hairline px-4 py-3 font-mono text-[11px] uppercase tracking-[0.13em] text-secondary hover:border-ink flex items-center justify-between"
        >
          <span>Scheme</span>
          <span>{current ? current.name : 'Stock paper'}</span>
        </button>
      )}

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
              className="glass fixed bottom-[calc(12px+env(safe-area-inset-bottom))] left-1/2 z-[70] w-[min(94vw,420px)] max-h-[calc(100dvh-72px)] -translate-x-1/2 overflow-y-auto rounded-sheet p-5"
            >
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="font-display text-base">Palette</p>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-secondary">
                    {current
                      ? `${current.name} — ${current.vibe}`
                      : 'Stock Paper — the pressing-plant default'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => select(null)}
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

              <div className="grid grid-cols-3 gap-2">
                {SCHEMES.map(p => {
                  const locked = !!p.unlockAt && (access?.contributions ?? 0) < p.unlockAt;
                  const selected = schemeId === p.id || (schemeId === null && p.id === 'stock');
                  const dots = [p.roles.rank, p.roles.interactive, p.roles.emotion, p.roles.confirm];
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => choose(p)}
                      aria-pressed={selected}
                      title={
                        locked ? `Unlocks at ${fmtInt(p.unlockAt)} contributions` : p.vibe
                      }
                      aria-label={
                        locked
                          ? `${p.name} — unlocks at ${fmtInt(p.unlockAt)} contributions`
                          : `${p.name} — ${p.vibe}`
                      }
                      className={`press relative rounded-chip border p-1.5 text-left ${
                        selected
                          ? /* Selection chrome speaks the CURRENT palette's
                               interactive hue — border-cobalt aliases
                               var(--role-interactive) in globals.css. */
                            'border-cobalt shadow-[0_0_0_1px_var(--color-cobalt)]'
                          : 'border-hairline hover:border-ink/40'
                      }`}
                    >
                      {/* 5-color swatch: the palette's paper ground carrying a
                          card pill with the four role dots (rank, interactive,
                          emotion, confirm — always in that order). Ambient
                          tiles hint their role-hue wash on the ground. */}
                      <span
                        aria-hidden
                        className="flex h-11 items-center justify-center overflow-hidden rounded-[6px] border"
                        style={{
                          borderColor: `${p.neutrals.ink}22`,
                          background: p.ambient
                            ? `radial-gradient(120% 110% at 16% 10%, ${p.roles.interactive}30 0%, transparent 58%), radial-gradient(120% 110% at 86% 88%, ${p.roles.emotion}2A 0%, transparent 60%), ${p.neutrals.paper}`
                            : p.neutrals.paper,
                        }}
                      >
                        <span
                          className="flex items-center gap-[3px] rounded-full px-1.5 py-1"
                          style={{ background: p.neutrals.card }}
                        >
                          {dots.map((hue, i) => (
                            <span
                              key={i}
                              className="h-2 w-2 rounded-full"
                              style={{ background: hue }}
                            />
                          ))}
                        </span>
                      </span>
                      <span className="mt-1 block truncate font-mono text-[9px] uppercase tracking-wide text-secondary">
                        {p.name}
                      </span>
                      {locked && (
                        <span
                          aria-hidden
                          className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full"
                          style={{ background: p.neutrals.ink, color: p.neutrals.paper }}
                        >
                          <svg width="7" height="8" viewBox="0 0 8 9" fill="none" aria-hidden>
                            <rect x="0.75" y="3.75" width="6.5" height="4.5" rx="1" fill="currentColor" />
                            <path
                              d="M2.25 4V2.4a1.75 1.75 0 1 1 3.5 0V4"
                              stroke="currentColor"
                              strokeWidth="1.1"
                            />
                          </svg>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {note && (
                <p className="mt-3 font-mono text-[10px] leading-relaxed text-secondary">{note}</p>
              )}
              <p className="mt-4 font-mono text-[10px] leading-relaxed text-secondary">
                A palette re-inks the whole pressing — paper, cards, ink and all four color roles:
                rank, interactive, emotion, confirm. One hue per job, so color still means
                something. The last four drift: slow ambient washes in their own hues, unlocked at{' '}
                {fmtInt(25)}/{fmtInt(50)}/{fmtInt(75)}/{fmtInt(100)} contributions.
              </p>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
