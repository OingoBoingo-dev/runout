'use client';

import { useRouter } from 'next/navigation';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { saveList, setListStatus } from '@/app/actions/lists';
import { Cover } from '@/components/Cover';
import { fmtInt, fmtPos, fmtYear } from '@/lib/format';
import type { Kind, ListStatus } from '@/lib/types';

export interface BuilderEntry {
  mbid: string;
  title: string;
  artist: string;
  year: number | null;
  cover: string | null;
  blurb: string;
}

interface SearchResult {
  mbid: string;
  title: string;
  artist_name: string;
  year: number | null;
  cover_url: string | null;
}

export function ListBuilder(props: {
  listId?: string;
  initialTitle?: string;
  initialDescription?: string;
  initialKind?: Kind;
  initialStatus?: ListStatus;
  initialEntries?: BuilderEntry[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(props.initialTitle ?? '');
  const [description, setDescription] = useState(props.initialDescription ?? '');
  const [kind, setKind] = useState<Kind>(props.initialKind ?? 'album');
  const [status] = useState<ListStatus>(props.initialStatus ?? 'draft');
  const [entries, setEntries] = useState<BuilderEntry[]>(props.initialEntries ?? []);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // search-to-add
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchNote, setSearchNote] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const term = q.trim();
    if (!term) {
      // async so the reset doesn't set state synchronously inside the effect
      debounce.current = setTimeout(() => {
        setResults([]);
        setSearchNote(null);
      }, 0);
      return () => {
        if (debounce.current) clearTimeout(debounce.current);
      };
    }
    debounce.current = setTimeout(async () => {
      const mySeq = ++seq.current;
      setSearching(true);
      setSearchNote(null);
      try {
        const res = await fetch(`/api/mb/search?kind=${kind}&q=${encodeURIComponent(term)}`);
        if (mySeq !== seq.current) return;
        if (res.status === 503) {
          setSearchNote('Catalog queue is busy — pausing a moment, then try again.');
          setResults([]);
          return;
        }
        if (!res.ok) {
          setSearchNote('Search failed — try again.');
          setResults([]);
          return;
        }
        const json = (await res.json()) as { items: SearchResult[] };
        setResults(json.items);
        if (!json.items.length) setSearchNote(`No ${kind}s matched “${term}”.`);
      } catch {
        if (mySeq === seq.current) setSearchNote('Search failed — check your connection.');
      } finally {
        if (mySeq === seq.current) setSearching(false);
      }
    }, 500);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [q, kind]);

  const atCap = entries.length >= 999;

  const add = (r: SearchResult) => {
    setError(null);
    if (atCap) {
      setError('This list is at the 999-entry cap — remove something to add more.');
      return;
    }
    if (entries.some(e => e.mbid === r.mbid)) return;
    setEntries(es => [
      ...es,
      { mbid: r.mbid, title: r.title, artist: r.artist_name, year: r.year, cover: r.cover_url, blurb: '' },
    ]);
  };

  // ---- reorder core --------------------------------------------------------
  // Row DOM nodes keyed by mbid (stable across reorders) — used for FLIP
  // measurement and drag target math.
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  // Row tops captured immediately before a reorder commits; consumed once by
  // the FLIP effect below. Null = no settle animation pending.
  const flipTops = useRef<Map<string, number> | null>(null);

  const captureRects = () => {
    const tops = new Map<string, number>();
    rowRefs.current.forEach((node, key) => tops.set(key, node.getBoundingClientRect().top));
    flipTops.current = tops;
  };

  /** Remove `from`, re-insert so the entry lands at final index `to`.
   *  Remove-then-insert makes `to` direction-agnostic: splicing into the
   *  already-shortened array places the item at exactly index `to`. */
  const applyMove = (from: number, to: number) =>
    setEntries(es => {
      if (from === to || from < 0 || to < 0 || from >= es.length || to >= es.length) return es;
      const next = es.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });

  const moveTo = (from: number, to: number) => {
    if (from === to) return;
    captureRects();
    applyMove(from, to);
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= entries.length) return;
    moveTo(i, j);
  };

  const remove = (i: number) => setEntries(es => es.filter((_, idx) => idx !== i));

  // Settle motion (FLIP): after a reorder commits, each displaced row starts
  // at an inverted translateY from its old slot and eases to identity. Reads
  // are batched before writes (one forced reflow total) so 100+ entry lists
  // don't thrash layout. Skipped entirely under prefers-reduced-motion.
  useLayoutEffect(() => {
    const prev = flipTops.current;
    if (!prev || !entries.length) return;
    flipTops.current = null;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const moved: [HTMLDivElement, number][] = [];
    rowRefs.current.forEach((node, key) => {
      // read phase
      const before = prev.get(key);
      if (before === undefined) return;
      const dy = before - node.getBoundingClientRect().top;
      if (dy) moved.push([node, dy]);
    });
    if (!moved.length) return;
    for (const [node, dy] of moved) {
      // write phase: park rows at their old positions
      node.style.transition = 'none';
      node.style.transform = `translateY(${dy}px)`;
    }
    void document.body.offsetHeight; // single forced reflow commits start state
    for (const [node] of moved) {
      node.style.transition = 'transform 180ms var(--ease-blanket)';
      node.style.transform = '';
    }
    const timer = setTimeout(() => {
      for (const [node] of moved) node.style.transition = '';
    }, 220);
    return () => clearTimeout(timer);
  }, [entries]);

  // Touch + mouse reorder via Pointer Events, grip-initiated. The grip
  // captures the pointer; only the lifted row is transformed (layout of the
  // rest never changes mid-drag), so row midpoints measured at lift stay
  // valid for computing the drop target.
  const drag = useRef<{
    from: number;
    to: number; // final index if dropped now
    startY: number;
    node: HTMLDivElement;
    mids: number[]; // row vertical midpoints at lift, in entry order
  } | null>(null);
  // Insertion cue: gap index 0..entries.length (line above row g; g === length
  // means below the last row). Null = hidden.
  const [dropGap, setDropGap] = useState<number | null>(null);

  const liftStyles = (node: HTMLDivElement) => {
    node.style.zIndex = '10';
    node.style.position = 'relative';
    node.style.background = 'var(--color-card)';
    node.style.boxShadow = '5px 5px 0 rgba(22, 21, 15, 0.14), 5px 7px 14px rgba(22, 21, 15, 0.12)';
    node.style.transition = 'none';
  };
  const dropStyles = (node: HTMLDivElement) => {
    node.style.zIndex = '';
    node.style.position = '';
    node.style.background = '';
    node.style.boxShadow = '';
    node.style.transition = '';
    node.style.transform = '';
  };

  const gripDown = (i: number) => (ev: ReactPointerEvent<HTMLSpanElement>) => {
    if (drag.current || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
    const node = rowRefs.current.get(entries[i].mbid);
    if (!node) return;
    ev.preventDefault();
    ev.currentTarget.setPointerCapture(ev.pointerId);
    const mids = entries.map(x => {
      const r = rowRefs.current.get(x.mbid)!.getBoundingClientRect();
      return r.top + r.height / 2;
    });
    drag.current = { from: i, to: i, startY: ev.clientY, node, mids };
    liftStyles(node);
  };

  const gripMove = (ev: ReactPointerEvent<HTMLSpanElement>) => {
    const d = drag.current;
    if (!d) return;
    d.node.style.transform = `translateY(${ev.clientY - d.startY}px)`;
    // Final index = how many OTHER rows sit above the pointer.
    let to = 0;
    for (let j = 0; j < d.mids.length; j++) {
      if (j !== d.from && d.mids[j] < ev.clientY) to++;
    }
    if (to !== d.to) {
      d.to = to;
      // Landing below the origin means the item drops under row `to`, so the
      // visual gap sits one row lower than the final index.
      setDropGap(to === d.from ? null : to + (to > d.from ? 1 : 0));
    }
  };

  const gripEnd = (commit: boolean) => (ev: ReactPointerEvent<HTMLSpanElement>) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setDropGap(null);
    try {
      ev.currentTarget.releasePointerCapture(ev.pointerId);
    } catch {}
    if (commit && d.to !== d.from) {
      captureRects(); // reads the lifted position — FLIP settles from the drop point
      dropStyles(d.node);
      applyMove(d.from, d.to);
    } else {
      // No move: ease the row back into its slot.
      const node = d.node;
      node.style.transition = 'transform 180ms var(--ease-blanket)';
      node.style.transform = '';
      setTimeout(() => dropStyles(node), 200);
    }
  };

  // Position jump: tap/click (or Enter on) the position number → numeric
  // input; Enter/blur commits, Escape cancels. Clamped to 1..length.
  const [editPos, setEditPos] = useState<number | null>(null);
  const [posDraft, setPosDraft] = useState('');
  const refocus = useRef<string | null>(null); // mbid whose pos button re-takes focus (keyboard exits only)

  const commitJump = (from: number) => {
    setEditPos(null);
    const n = parseInt(posDraft, 10);
    if (!Number.isFinite(n)) return; // invalid → no-op
    const to = Math.min(Math.max(n, 1), entries.length) - 1;
    moveTo(from, to); // no-ops when target === current
  };

  useEffect(() => {
    if (editPos !== null || !refocus.current) return;
    const btn = rowRefs.current
      .get(refocus.current)
      ?.querySelector<HTMLButtonElement>('button[data-pos-btn]');
    refocus.current = null;
    btn?.focus();
  }, [editPos]);

  const persist = (nextStatus: ListStatus) => {
    setError(null);
    startTransition(async () => {
      const res = await saveList({
        id: props.listId,
        title,
        description,
        kind,
        status: nextStatus,
        entries: entries.map(e => ({ mbid: e.mbid, blurb: e.blurb })),
      });
      if (res.error) setError(res.error);
      else if (res.id) {
        router.push(`/list/${res.id}`);
        router.refresh();
      }
    });
  };

  const unpublish = () => {
    if (!props.listId) return;
    setError(null);
    startTransition(async () => {
      const res = await setListStatus(props.listId!, 'draft');
      if (res.error) setError(res.error);
      else {
        router.push(`/list/${props.listId}`);
        router.refresh();
      }
    });
  };

  const label = 'mb-1.5 block font-mono text-[11px] uppercase tracking-[0.13em] text-secondary';
  const input =
    'w-full rounded-chip border border-hairline bg-ink/5 px-4 py-3 text-ink placeholder:text-secondary/60 focus:border-cobalt focus:outline-none';

  return (
    <div>
      <div className="rounded-card border border-hairline bg-card p-5 text-ink">
        <div className="grid gap-x-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={label} htmlFor="b-title">Title</label>
            <input
              id="b-title"
              className={input}
              value={title}
              maxLength={140}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. 100 Records That Rewired My Ears"
            />
          </div>
          <div className="mt-4 sm:col-span-2">
            <label className={label} htmlFor="b-desc">Description</label>
            <textarea
              id="b-desc"
              className={`${input} min-h-[64px]`}
              value={description}
              maxLength={1000}
              onChange={e => setDescription(e.target.value)}
              placeholder="What holds this list together?"
            />
          </div>
          <div className="mt-4">
            <label className={label} htmlFor="b-kind">List type</label>
            <select
              id="b-kind"
              className={input}
              value={kind}
              disabled={entries.length > 0}
              onChange={e => {
                setKind(e.target.value as Kind);
                setResults([]);
                setQ('');
              }}
            >
              <option value="album">Albums</option>
              <option value="song">Songs</option>
            </select>
            {entries.length > 0 && (
              <p className="mt-1.5 font-mono text-[11px] text-secondary">
                A list holds one kind — remove all entries to change type.
              </p>
            )}
          </div>
          <div className="mt-4">
            <span className={label}>Status</span>
            <div className="flex min-h-[44px] items-center gap-3">
              <span
                className={`rounded-full px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.11em] ${
                  status === 'published'
                    ? 'bg-green text-paper'
                    : 'border border-dashed border-secondary text-secondary'
                }`}
              >
                {status}
              </span>
              <span
                className={`font-mono text-xs tabular-nums ${atCap ? 'font-semibold text-red' : 'text-secondary'}`}
              >
                {fmtInt(entries.length)} / 999
              </span>
            </div>
          </div>
        </div>
        {error && <p className="mt-3 font-mono text-xs text-red">{error}</p>}
        {/* Save/Publish — floating glass action bar on mobile, inline on desktop. */}
        <div className="mt-4 flex flex-wrap gap-2 max-md:fixed max-md:bottom-[calc(88px+env(safe-area-inset-bottom))] max-md:left-1/2 max-md:z-40 max-md:mt-0 max-md:w-[min(94vw,400px)] max-md:-translate-x-1/2 max-md:justify-center max-md:rounded-sheet max-md:p-2 max-md:glass">
          {status === 'published' ? (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() => persist('published')}
                className="press rounded-chip bg-red px-5 py-3 font-mono text-xs font-semibold uppercase tracking-wider text-paper disabled:opacity-60"
              >
                Save changes
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={unpublish}
                className="rounded-chip border border-hairline px-5 py-3 font-mono text-xs uppercase tracking-wider hover:border-ink disabled:opacity-60"
              >
                Unpublish to draft
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() => persist('published')}
                className="press rounded-chip bg-red px-5 py-3 font-mono text-xs font-semibold uppercase tracking-wider text-paper disabled:opacity-60"
              >
                Publish list
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => persist('draft')}
                className="rounded-chip border border-hairline px-5 py-3 font-mono text-xs uppercase tracking-wider hover:border-ink disabled:opacity-60"
              >
                {props.listId ? 'Save draft' : 'Save as draft'}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[340px_1fr]">
        <aside className="lg:sticky lg:top-[72px]">
          <div className="rounded-card border border-hairline bg-card p-5 text-ink">
            <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.16em] text-secondary">
              Search to add · {kind}s
            </h2>
            <input
              type="search"
              className={input}
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Title or artist…"
              aria-label={`Search ${kind}s to add`}
            />
            <div className="mt-3 max-h-[52vh] overflow-y-auto">
              {searching && (
                <p className="py-3 font-mono text-xs text-secondary">
                  Searching… (queued at ~1 request/second)
                </p>
              )}
              {searchNote && !searching && (
                <p className="py-3 font-mono text-xs text-secondary">{searchNote}</p>
              )}
              {!searching &&
                results.map(r => {
                  const added = entries.some(e => e.mbid === r.mbid);
                  return (
                    <div key={r.mbid} className="flex items-center gap-2.5 border-b border-hairline py-2 last:border-0">
                      <Cover src={r.cover_url} title={r.title} artist={r.artist_name} className="w-10 flex-none" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold">{r.title}</span>
                        <span className="block truncate font-mono text-[11px] tabular-nums text-secondary">
                          {r.artist_name}
                          {fmtYear(r.year) ? ` · ${fmtYear(r.year)}` : ''}
                        </span>
                      </span>
                      {added ? (
                        <span className="flex-none rounded-chip border border-hairline px-2.5 py-1 font-mono text-[10px] uppercase text-secondary">
                          added
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={atCap}
                          onClick={() => add(r)}
                          className="flex-none rounded-chip border border-hairline px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide hover:border-cobalt hover:text-cobalt disabled:opacity-40"
                        >
                          Add
                        </button>
                      )}
                    </div>
                  );
                })}
              {!searching && !results.length && !searchNote && (
                <p className="py-3 font-mono text-[11px] leading-relaxed text-secondary">
                  Live results from MusicBrainz land here — throttled to ~1 request/second through
                  the proxy.
                </p>
              )}
            </div>
          </div>
        </aside>

        <section>
          <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.16em] text-secondary">
            Ranked entries — drag the grip, tap a position, or use the arrows
          </h2>
          <div className="rounded-card border border-hairline bg-card py-1 text-ink">
            {entries.length === 0 && (
              <div className="px-6 py-10 text-center">
                <h3 className="font-display text-lg">Nothing ranked yet</h3>
                <p className="mt-1 text-sm text-secondary">
                  Search on the left and add {kind}s — position 01 is the top of the list.
                </p>
              </div>
            )}
            {entries.map((e, i) => (
              <div
                key={e.mbid}
                ref={node => {
                  if (node) rowRefs.current.set(e.mbid, node);
                  else rowRefs.current.delete(e.mbid);
                }}
                className={`flex items-start gap-2.5 border-b border-hairline px-3 py-3 last:border-0 ${
                  dropGap === i
                    ? 'shadow-[inset_0_3px_0_var(--color-cobalt)]'
                    : dropGap === entries.length && i === entries.length - 1
                      ? 'shadow-[inset_0_-3px_0_var(--color-cobalt)]'
                      : ''
                }`}
              >
                <span
                  title="Drag to reorder"
                  onPointerDown={gripDown(i)}
                  onPointerMove={gripMove}
                  onPointerUp={gripEnd(true)}
                  onPointerCancel={gripEnd(false)}
                  onContextMenu={ev => ev.preventDefault()}
                  className="mt-2 flex-none cursor-grab touch-none select-none px-2 py-3 text-secondary active:cursor-grabbing"
                  aria-hidden
                >
                  <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
                    <circle cx="2.5" cy="2.5" r="1.6" />
                    <circle cx="7.5" cy="2.5" r="1.6" />
                    <circle cx="2.5" cy="8" r="1.6" />
                    <circle cx="7.5" cy="8" r="1.6" />
                    <circle cx="2.5" cy="13.5" r="1.6" />
                    <circle cx="7.5" cy="13.5" r="1.6" />
                  </svg>
                </span>
                <span className="flex min-w-[44px] flex-none flex-col items-center">
                  {editPos === i ? (
                    <input
                      autoFocus
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={3}
                      value={posDraft}
                      aria-label={`New position for ${e.title}, 1 to ${fmtInt(entries.length)}`}
                      onFocus={ev => ev.currentTarget.select()}
                      onChange={ev => setPosDraft(ev.currentTarget.value.replace(/\D/g, ''))}
                      onKeyDown={ev => {
                        if (ev.key === 'Enter') {
                          ev.preventDefault();
                          refocus.current = e.mbid;
                          commitJump(i);
                        } else if (ev.key === 'Escape') {
                          refocus.current = e.mbid;
                          setEditPos(null);
                        }
                      }}
                      onBlur={() => commitJump(i)}
                      className="h-11 w-11 rounded-chip border border-cobalt bg-ink/5 text-center font-display text-lg tabular-nums focus:outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      data-pos-btn
                      onClick={() => {
                        setPosDraft(String(i + 1));
                        setEditPos(i);
                      }}
                      aria-label={`Position ${fmtInt(i + 1)} of ${fmtInt(entries.length)} — change position for ${e.title}`}
                      className="flex h-11 w-11 items-center justify-center rounded-chip hover:bg-ink/5 focus-visible:bg-ink/5"
                    >
                      <b
                        className={`font-display text-xl font-normal leading-none tabular-nums ${
                          i < 3 ? 'text-cobalt' : ''
                        }`}
                      >
                        {fmtPos(i + 1, entries.length)}
                      </b>
                    </button>
                  )}
                  <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-secondary">
                    pos
                  </span>
                </span>
                <Cover src={e.cover} title={e.title} artist={e.artist} className="mt-1 w-10 flex-none" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{e.title}</span>
                  <span className="block truncate font-mono text-xs tabular-nums text-secondary">
                    {e.artist}
                    {fmtYear(e.year) ? ` · ${fmtYear(e.year)}` : ''}
                  </span>
                  <textarea
                    value={e.blurb}
                    maxLength={280}
                    placeholder="Add a blurb (optional, 280 max)"
                    aria-label={`Blurb for ${e.title}`}
                    onChange={ev =>
                      setEntries(es => es.map((x, xi) => (xi === i ? { ...x, blurb: ev.target.value } : x)))
                    }
                    className="mt-2 min-h-[42px] w-full rounded-chip border border-hairline bg-ink/5 p-2 text-[13px] focus:border-cobalt focus:outline-none"
                  />
                  <span className="mt-1 block text-right font-mono text-[10px] tabular-nums text-secondary">
                    {e.blurb.length}/280
                  </span>
                </span>
                <span className="flex flex-none flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label={`Move ${e.title} up one position`}
                    className="flex h-8 w-8 items-center justify-center rounded-chip border border-hairline font-mono text-[13px] hover:border-cobalt hover:text-cobalt disabled:opacity-40"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === entries.length - 1}
                    aria-label={`Move ${e.title} down one position`}
                    className="flex h-8 w-8 items-center justify-center rounded-chip border border-hairline font-mono text-[13px] hover:border-cobalt hover:text-cobalt disabled:opacity-40"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    aria-label={`Remove ${e.title} from the list`}
                    className="flex h-8 w-8 items-center justify-center rounded-chip border border-hairline font-mono text-[13px] hover:border-cobalt hover:text-cobalt"
                  >
                    ×
                  </button>
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
