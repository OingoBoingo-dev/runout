'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { fmtCount, fmtInt } from '@/lib/format';
import type { ListType } from '@/lib/types';
import { GENRES, LIST_TYPES } from '@/lib/validate';

export interface PublishChoice {
  status: 'published' | 'private';
  listType: ListType | null;
  genres: string[];
}

/**
 * The publish decision popup. Mount it only while open (state initializes
 * from props on mount, so each opening starts fresh). Portaled to <body>
 * for the same reason VinylTheme is: the glass chrome's backdrop-filter
 * creates a containing block that would trap a fixed sheet.
 *
 * Step 1 — visibility. Private confirms immediately.
 * Step 2 — public only: Top-N size + up to three broad genres.
 * Red is reserved for the Publish action per the pressing-plant rules.
 */
export function PublishSheet({
  entryCount,
  pending,
  initialStatus,
  initialListType,
  initialGenres,
  onClose,
  onConfirm,
}: {
  entryCount: number;
  pending: boolean;
  initialStatus: 'published' | 'private' | 'draft';
  initialListType: ListType | null;
  initialGenres: string[];
  onClose: () => void;
  onConfirm: (choice: PublishChoice) => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [listType, setListType] = useState<ListType | null>(initialListType);
  const [genres, setGenres] = useState<string[]>(
    initialGenres.filter(g => (GENRES as readonly string[]).includes(g)),
  );

  const toggleGenre = (g: string) =>
    setGenres(gs => (gs.includes(g) ? gs.filter(x => x !== g) : gs.length < 3 ? [...gs, g] : gs));

  const publishable =
    !pending && listType !== null && genres.length >= 1 && entryCount <= (listType ?? 0);

  const card =
    'press w-full rounded-card border p-4 text-left disabled:opacity-50';
  const chip =
    'press rounded-chip border px-3.5 py-2 font-mono text-xs uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-35';

  return createPortal(
    <>
      <button
        aria-label="Close publish panel"
        className="fixed inset-0 z-[60] cursor-default bg-ink/30"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Publish this list"
        className="glass fixed bottom-[calc(12px+env(safe-area-inset-bottom))] left-1/2 z-[70] max-h-[82dvh] w-[min(94vw,480px)] -translate-x-1/2 overflow-y-auto rounded-sheet p-5"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-secondary">
              Step {fmtInt(step)} of {fmtInt(2)}
            </p>
            <p className="mt-1 font-display text-lg">
              {step === 1 ? 'Who sees this?' : 'What is it?'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="press rounded-full border border-hairline px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide"
          >
            Cancel
          </button>
        </div>

        {step === 1 && (
          <div className="space-y-2.5">
            <button
              type="button"
              disabled={pending}
              onClick={() => setStep(2)}
              className={`${card} ${
                initialStatus !== 'private'
                  ? 'border-cobalt shadow-[0_0_0_1px_var(--color-cobalt)]'
                  : 'border-hairline hover:border-cobalt/60'
              }`}
            >
              <span className="block font-semibold">Public</span>
              <span className="mt-0.5 block text-sm text-secondary">
                On the charts, on your profile, shareable by link.
              </span>
              <span className="mt-1.5 block font-mono text-[10px] uppercase tracking-wider text-cobalt">
                next: pick a size and genres →
              </span>
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => onConfirm({ status: 'private', listType: null, genres: [] })}
              className={`${card} ${
                initialStatus === 'private'
                  ? 'border-cobalt shadow-[0_0_0_1px_var(--color-cobalt)]'
                  : 'border-hairline hover:border-cobalt/60'
              }`}
            >
              <span className="block font-semibold">Private</span>
              <span className="mt-0.5 block text-sm text-secondary">
                Only you. Off the charts, off your public profile.
              </span>
              <span className="mt-1.5 block font-mono text-[10px] uppercase tracking-wider text-secondary">
                {pending ? 'saving…' : 'saves immediately'}
              </span>
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.13em] text-secondary">
              Top how many?
            </p>
            <div className="flex flex-wrap gap-2">
              {LIST_TYPES.map(n => {
                const tooSmall = entryCount > n;
                return (
                  <button
                    key={n}
                    type="button"
                    disabled={tooSmall || pending}
                    aria-pressed={listType === n}
                    onClick={() => setListType(n)}
                    className={`${chip} ${
                      listType === n
                        ? 'border-cobalt text-cobalt shadow-[0_0_0_1px_var(--color-cobalt)]'
                        : 'border-hairline hover:border-cobalt/60'
                    }`}
                  >
                    Top {fmtInt(n)}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 font-mono text-[10px] tabular-nums text-secondary">
              you have {fmtCount(entryCount, 'entry', 'entries')} — sizes below that are off
            </p>

            <p className="mb-2 mt-5 font-mono text-[11px] uppercase tracking-[0.13em] text-secondary">
              Genres — pick {fmtInt(1)} to {fmtInt(3)} (“all time” is the catch-all)
            </p>
            <div className="flex max-h-[30dvh] flex-wrap gap-1.5 overflow-y-auto">
              {GENRES.map(g => {
                const on = genres.includes(g);
                const full = !on && genres.length >= 3;
                return (
                  <button
                    key={g}
                    type="button"
                    disabled={full || pending}
                    aria-pressed={on}
                    onClick={() => toggleGenre(g)}
                    className={`press rounded-full border px-3 py-1.5 font-mono text-[11px] tracking-wide disabled:opacity-35 ${
                      on
                        ? 'border-cobalt text-cobalt shadow-[0_0_0_1px_var(--color-cobalt)]'
                        : 'border-hairline text-secondary hover:border-cobalt/60 hover:text-ink'
                    }`}
                  >
                    {g}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="press rounded-chip border border-hairline px-4 py-2.5 font-mono text-xs uppercase tracking-wider"
              >
                ← Back
              </button>
              <button
                type="button"
                disabled={!publishable}
                onClick={() =>
                  listType && onConfirm({ status: 'published', listType, genres })
                }
                className="press rounded-chip bg-red px-5 py-3 font-mono text-xs font-semibold uppercase tracking-wider text-paper disabled:opacity-50"
              >
                {pending ? 'Publishing…' : 'Publish'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>,
    document.body,
  );
}
