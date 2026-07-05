'use client';

import { useEffect, useState, useTransition } from 'react';
import { getBorderAccess, saveBorder } from '@/app/actions/profile';
import { AvatarFrame, BORDERS, type Border } from '@/lib/borders';
import { fmtInt } from '@/lib/format';

/**
 * Avatar-frame picker for Settings: a grid of the 12 vinyl frames wrapped
 * around a neutral ink disc preview. Free frames (unlockAt 0) select
 * immediately; the four locked frames render fully but desaturated with a
 * padlock chip, and clicking one surfaces the requirement inline. Selection
 * persists via saveBorder (server re-checks the unlock threshold); the frame
 * then shows to every visitor on the profile. Cobalt marks the selection.
 */

interface Access {
  contributions: number;
  savedBorder: string | null;
}

/** Neutral ink disc standing in for the avatar inside each preview. */
function DiscPreview() {
  return <span aria-hidden className="block h-full w-full rounded-full bg-ink" />;
}

export function BorderPicker() {
  const [access, setAccess] = useState<Access | null>(null);
  const [borderId, setBorderId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Lazily fetch unlock progress + saved frame on mount.
  useEffect(() => {
    let alive = true;
    getBorderAccess()
      .then(a => {
        if (!alive) return;
        setAccess(a);
        setBorderId(a.savedBorder);
      })
      .catch(() => {
        if (alive) setAccess({ contributions: 0, savedBorder: null });
      });
    return () => {
      alive = false;
    };
  }, []);

  const contributions = access?.contributions ?? 0;

  const persist = (id: string | null) => {
    const prev = borderId;
    setBorderId(id);
    startTransition(async () => {
      const res = await saveBorder(id);
      if ('error' in res) {
        if (res.error === 'frame sync pending migration')
          setNote('Saved on this device — account sync arrives with the next migration.');
        else {
          setNote(res.error);
          setBorderId(prev); // roll back on a real failure
        }
      }
    });
  };

  const choose = (b: Border) => {
    setNote(null);
    if (b.unlockAt && contributions < b.unlockAt) {
      setNote(
        `“${b.name}” unlocks at ${fmtInt(b.unlockAt)} contributions (published lists + ratings + comments) — you're at ${fmtInt(contributions)}.`,
      );
      return;
    }
    persist(borderId === b.id ? null : b.id);
  };

  return (
    <div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {BORDERS.map(b => {
          const locked = !!b.unlockAt && contributions < b.unlockAt;
          const selected = borderId === b.id;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => choose(b)}
              disabled={pending}
              aria-pressed={selected}
              title={
                locked
                  ? `LOCKED — UNLOCKS AT ${fmtInt(b.unlockAt)} CONTRIBUTIONS`
                  : `${b.name} — ${b.vibe}`
              }
              aria-label={
                locked
                  ? `${b.name} — locked, unlocks at ${fmtInt(b.unlockAt)} contributions`
                  : `${b.name} — ${b.vibe}`
              }
              className={`press relative flex min-h-[44px] flex-col items-center gap-1 rounded-chip border p-1.5 ${
                selected
                  ? 'border-cobalt shadow-[0_0_0_1px_var(--color-cobalt)]'
                  : 'border-hairline hover:border-ink/40'
              }`}
            >
              <span
                aria-hidden
                className="relative block"
                style={locked ? { opacity: 0.35, filter: 'grayscale(1)' } : undefined}
              >
                <AvatarFrame borderId={b.id} size={44}>
                  <DiscPreview />
                </AvatarFrame>
                {locked && (
                  <span
                    aria-hidden
                    className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-ink text-paper"
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
              </span>
              <span className="block max-w-full truncate font-mono text-[8.5px] uppercase tracking-wide text-secondary">
                {b.name}
              </span>
            </button>
          );
        })}
      </div>

      {note && (
        <p className="mt-3 font-mono text-[10px] leading-relaxed text-secondary">{note}</p>
      )}
      <p className="mt-3 font-mono text-[10px] leading-relaxed text-secondary">
        Frames wrap your avatar everywhere it appears. Eight are free; the last four unlock at{' '}
        {fmtInt(25)}/{fmtInt(50)}/{fmtInt(75)}/{fmtInt(100)} contributions and drift slowly. Tap a
        selected frame again to clear it.
      </p>
    </div>
  );
}
