'use client';

/* eslint-disable react-hooks/set-state-in-effect --
   the persisted scheme must hydrate after mount (localStorage is client-only)
   and unlock data loads lazily when the sheet opens. */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getThemeAccess, saveThemeScheme } from '@/app/actions/profile';
import { fmtInt } from '@/lib/format';
import { applyScheme, getScheme, SCHEMES, type Scheme } from '@/lib/themes';

/**
 * Vinyl theme picker (aesthetic-synthesis, adapted to Pressing-Plant rules):
 * a spinning record in the top bar opens a glass sheet with 12 curated
 * schemes. A scheme re-tints the NEUTRAL system — paper ground, card
 * surface, ink, secondary, hairlines, and therefore the glass chrome —
 * while the four primaries keep their semantic jobs (yellow rank / cobalt
 * interactive / red emotion / green confirmation). Persists locally always;
 * syncs to profiles.theme_scheme when signed in (tolerating the pending
 * migration). The last four schemes are ambient washes that unlock at
 * 25/50/75/100 contributions.
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

  // Hydrate the persisted scheme (localStorage is client-only).
  useEffect(() => {
    try {
      const s = getScheme(localStorage.getItem(STORAGE_KEY));
      if (s) {
        setSchemeId(s.id);
        applyScheme(s);
      }
    } catch {}
  }, []);

  // Lazily fetch unlock progress + account scheme when the sheet first opens.
  useEffect(() => {
    if (!open || access) return;
    let alive = true;
    getThemeAccess()
      .then(a => {
        if (!alive) return;
        setAccess(a);
        // Cross-device: adopt the account scheme only if this device hasn't
        // picked one of its own.
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

  const choose = (s: Scheme) => {
    if (s.unlockAt && (access?.contributions ?? 0) < s.unlockAt) {
      setNote(
        `“${s.name}” unlocks at ${fmtInt(s.unlockAt)} contributions (published lists + ratings + comments) — you're at ${fmtInt(access?.contributions ?? 0)}.`,
      );
      return;
    }
    select(s.id);
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
        /* Settings-aesthetic trigger: label left, live scheme name right.
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
              className="glass fixed bottom-[calc(12px+env(safe-area-inset-bottom))] left-1/2 z-[70] w-[min(94vw,420px)] -translate-x-1/2 rounded-sheet p-5"
            >
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="font-display text-base">Scheme</p>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-secondary">
                    {current
                      ? `${current.name} — ${current.vibe}`
                      : 'Stock paper — pressing-plant primaries stay fixed'}
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

              <div className="grid grid-cols-4 gap-2">
                {SCHEMES.map(s => {
                  const locked = !!s.unlockAt && (access?.contributions ?? 0) < s.unlockAt;
                  const selected = schemeId === s.id || (schemeId === null && s.id === 'stock');
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => choose(s)}
                      aria-pressed={selected}
                      title={
                        locked ? `Unlocks at ${fmtInt(s.unlockAt ?? 0)} contributions` : s.vibe
                      }
                      aria-label={
                        locked
                          ? `${s.name} — unlocks at ${fmtInt(s.unlockAt ?? 0)} contributions`
                          : `${s.name} — ${s.vibe}`
                      }
                      className={`press relative rounded-chip border p-1.5 text-left ${
                        selected
                          ? 'border-cobalt shadow-[0_0_0_1px_var(--color-cobalt)]'
                          : 'border-hairline hover:border-ink/40'
                      }`}
                    >
                      <span
                        aria-hidden
                        className="block h-11 overflow-hidden rounded-[6px] border"
                        style={{
                          borderColor: `${s.colors.ink}22`,
                          background: s.ambient
                            ? `radial-gradient(130% 100% at 18% 12%, ${s.colors.secondary}59 0%, transparent 62%), radial-gradient(110% 95% at 84% 82%, ${s.colors.secondary}33 0%, transparent 65%), ${s.colors.paper}`
                            : s.colors.paper,
                        }}
                      >
                        <span
                          className="m-1.5 flex h-4 items-center gap-1 rounded-[4px] px-1"
                          style={{ background: s.colors.card }}
                        >
                          <span
                            className="h-1 w-4 rounded-full"
                            style={{ background: s.colors.ink }}
                          />
                          <span
                            className="h-1 w-2.5 rounded-full"
                            style={{ background: s.colors.secondary }}
                          />
                        </span>
                      </span>
                      <span className="mt-1 block truncate font-mono text-[9px] uppercase tracking-wide text-secondary">
                        {s.name}
                      </span>
                      {locked && (
                        <span
                          aria-hidden
                          className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full"
                          style={{ background: s.colors.ink, color: s.colors.paper }}
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
                Schemes tint the paper, surfaces and hairlines. Yellow, cobalt, red and green keep
                their jobs — color means something here. The last four drift: slow ambient washes,
                unlocked at {fmtInt(25)}/{fmtInt(50)}/{fmtInt(75)}/{fmtInt(100)} contributions.
              </p>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
