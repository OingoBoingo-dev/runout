'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
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

  const move = (i: number, dir: -1 | 1) => {
    setEntries(es => {
      const j = i + dir;
      if (j < 0 || j >= es.length) return es;
      const next = es.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const remove = (i: number) => setEntries(es => es.filter((_, idx) => idx !== i));

  // drag and drop (grip-initiated)
  const dragIdx = useRef<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [draggable, setDraggable] = useState<number | null>(null);

  const drop = (to: number) => {
    const from = dragIdx.current;
    dragIdx.current = null;
    setOverIdx(null);
    setDraggable(null);
    if (from === null || from === to) return;
    setEntries(es => {
      const next = es.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

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
            Ranked entries — drag the grip or use the arrows
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
                draggable={draggable === i}
                onDragStart={ev => {
                  dragIdx.current = i;
                  ev.dataTransfer.effectAllowed = 'move';
                  try {
                    ev.dataTransfer.setData('text/plain', '');
                  } catch {}
                }}
                onDragOver={ev => {
                  ev.preventDefault();
                  setOverIdx(i);
                }}
                onDragLeave={() => setOverIdx(v => (v === i ? null : v))}
                onDrop={ev => {
                  ev.preventDefault();
                  drop(i);
                }}
                onDragEnd={() => {
                  dragIdx.current = null;
                  setOverIdx(null);
                  setDraggable(null);
                }}
                className={`flex items-start gap-2.5 border-b border-hairline px-3 py-3 last:border-0 ${
                  overIdx === i ? 'shadow-[inset_0_3px_0_var(--color-cobalt)]' : ''
                }`}
              >
                <span
                  title="Drag to reorder"
                  onMouseDown={() => setDraggable(i)}
                  onMouseUp={() => setDraggable(null)}
                  className="mt-3 flex-none cursor-grab px-1.5 py-2 text-secondary active:cursor-grabbing"
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
                <span className="mt-1 flex min-w-[44px] flex-none flex-col items-center">
                  <b
                    className={`font-display text-xl font-normal leading-none tabular-nums ${
                      i < 3 ? 'text-cobalt' : ''
                    }`}
                  >
                    {fmtPos(i + 1, entries.length)}
                  </b>
                  <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-secondary">
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
