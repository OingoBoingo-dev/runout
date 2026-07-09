import type { Metadata } from 'next';
import Link from 'next/link';
import { after } from 'next/server';
import { Cover } from '@/components/Cover';
import { resolveAndPersist } from '@/lib/covers';
import { formatYear } from '@/lib/format';
import { asCoverCandidate, MBBusyError, searchArtists, searchMB } from '@/lib/mb';
import type { ArtistResult } from '@/lib/types';

export const metadata: Metadata = { title: 'Search' };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const q = ((await searchParams).q ?? '').trim();

  if (!q) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-cobalt">Search</p>
        <h1 className="font-display text-3xl">Search the catalog</h1>
        <p className="mt-2 max-w-xl text-secondary">
          Type a title or artist in the bar above. Results come live from MusicBrainz through
          Ordko’s rate-limited proxy, and everything you open joins the local catalog.
        </p>
      </div>
    );
  }

  let artists: ArtistResult[] = [];
  let albums: Awaited<ReturnType<typeof searchMB>> = [];
  let songs: Awaited<ReturnType<typeof searchMB>> = [];
  let problem: string | null = null;
  try {
    // Sequential on purpose — all three go through the same 1.1s-spaced queue.
    artists = await searchArtists(q);
    albums = await searchMB('album', q);
    songs = await searchMB('song', q);
    // Resolve missing covers after the response — never blocks the page.
    after(() =>
      resolveAndPersist([...albums, ...songs].filter(i => !i.cover_url).map(asCoverCandidate)),
    );
  } catch (err) {
    problem =
      err instanceof MBBusyError
        ? 'The catalog queue is saturated right now — give it a few seconds and search again.'
        : 'MusicBrainz didn’t answer — try the search again in a moment.';
  }

  const Row = ({
    mbid,
    title,
    artist,
    year,
    cover,
    kind,
  }: {
    mbid: string;
    title: string;
    artist: string;
    year: number | null;
    cover: string | null;
    kind: string;
  }) => (
    <Link href={`/item/${mbid}`} className="group flex items-center gap-3 px-4 py-3">
      <Cover src={cover} title={title} artist={artist} className="w-12 flex-none" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold group-hover:text-cobalt">{title}</span>
        <span className="block truncate font-mono text-xs tabular-nums text-secondary">
          {artist}
          {formatYear(year) ? ` · ${formatYear(year)}` : ''}
        </span>
      </span>
      <span className="flex-none rounded-chip border border-hairline px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-secondary">
        {kind}
      </span>
    </Link>
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-cobalt">
        Search results
      </p>
      <h1 className="font-display text-3xl break-words">“{q}”</h1>

      {problem && <p className="mt-4 font-mono text-sm text-red">{problem}</p>}

      {/* Albums lead — for an album-title query the record itself must come first,
          not artists (e.g. tribute bands) that named themselves after it. */}
      <section className="mt-8">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-secondary">Albums</p>
        {albums.length ? (
          <div className="divide-y divide-hairline rounded-card border border-hairline bg-card py-1 text-ink">
            {albums.map(a => (
              <Row key={a.mbid} mbid={a.mbid} title={a.title} artist={a.artist_name} year={a.year} cover={a.cover_url} kind="album" />
            ))}
          </div>
        ) : (
          !problem && <p className="font-mono text-sm text-secondary">No albums matched “{q}”.</p>
        )}
      </section>

      <section className="mt-8">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-secondary">
          Artists
        </p>
        {artists.length ? (
          <div className="divide-y divide-hairline rounded-card border border-hairline bg-card py-1 text-ink">
            {artists.map(a => (
              <Link
                key={a.mbid}
                href={`/artist/${a.mbid}`}
                className="group flex items-center gap-3 px-4 py-3"
              >
                <span
                  aria-hidden
                  className="flex h-12 w-12 flex-none items-center justify-center rounded-full border border-hairline bg-ink/5 font-display text-lg text-secondary group-hover:text-cobalt"
                >
                  {(a.name[0] ?? '?').toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold group-hover:text-cobalt">
                    {a.name}
                  </span>
                  <span className="block truncate font-mono text-xs text-secondary">
                    {[a.type, a.disambiguation || a.area].filter(Boolean).join(' · ') || 'artist'}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        ) : (
          !problem && <p className="font-mono text-sm text-secondary">No artists matched “{q}”.</p>
        )}
      </section>

      <section className="mt-8">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-secondary">Songs</p>
        {songs.length ? (
          <div className="divide-y divide-hairline rounded-card border border-hairline bg-card py-1 text-ink">
            {songs.map(s => (
              <Row key={s.mbid} mbid={s.mbid} title={s.title} artist={s.artist_name} year={s.year} cover={s.cover_url} kind="song" />
            ))}
          </div>
        ) : (
          !problem && <p className="font-mono text-sm text-secondary">No songs matched “{q}”.</p>
        )}
      </section>
    </div>
  );
}
