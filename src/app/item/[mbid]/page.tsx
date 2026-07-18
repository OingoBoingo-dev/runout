import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArtistLink } from '@/components/ArtistLink';
import { Cover } from '@/components/Cover';
import { PinButton } from '@/components/PinButton';
import { Rank } from '@/components/Rank';
import { RateControl } from '@/components/RateControl';
import { Stars } from '@/components/Stars';
import { fmtCount, fmtRating, fmtYear, msToLen } from '@/lib/format';
import { fetchItemDetail } from '@/lib/mb';
import { supabaseServer } from '@/lib/supabase/server';
import type { CatalogItem, Track } from '@/lib/types';

export default async function ItemPage({ params }: { params: Promise<{ mbid: string }> }) {
  const { mbid } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(mbid)) notFound();

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let { data: item } = (await supabase
    .from('catalog_items')
    .select('*')
    .eq('mbid', mbid)
    .maybeSingle()) as { data: CatalogItem | null };

  let tracks: Track[] = [];
  let tracklistNote: string | null = null;

  if (!item) {
    // Cache miss — resolve via MusicBrainz (album first, then recording).
    try {
      const detail = await fetchItemDetail(mbid, 'album');
      item = { ...detail.item, fetched_at: new Date().toISOString() } as CatalogItem;
      tracks = detail.tracks;
    } catch {
      try {
        const detail = await fetchItemDetail(mbid, 'song');
        item = { ...detail.item, fetched_at: new Date().toISOString() } as CatalogItem;
      } catch {
        notFound();
      }
    }
  } else if (item.kind === 'album') {
    try {
      const detail = await fetchItemDetail(mbid, 'album');
      tracks = detail.tracks;
    } catch {
      tracklistNote = 'Tracklist is unavailable right now — MusicBrainz didn’t answer.';
    }
  }
  if (!item) notFound();

  const [{ data: ratingRows }, { data: entryRows }, { data: myProfile }] = await Promise.all([
    supabase.from('ratings').select('user_id, value').eq('item_mbid', mbid),
    supabase
      .from('list_entries')
      .select('position, lists!inner(id, title, status, kind, owner, profiles!lists_owner_fkey(username))')
      .eq('item_mbid', mbid)
      .eq('lists.status', 'published'),
    user
      ? supabase.from('profiles').select('pinned_items').eq('id', user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const ratings = (ratingRows ?? []) as { user_id: string; value: number }[];
  const avg = ratings.length ? ratings.reduce((s, r) => s + Number(r.value), 0) / ratings.length : 0;
  const mine = user ? Number(ratings.find(r => r.user_id === user.id)?.value ?? 0) : 0;
  const pinned = ((myProfile?.pinned_items as string[] | undefined) ?? []).includes(mbid);

  type AppearRow = {
    position: number;
    lists: { id: string; title: string; profiles: { username: string } | null };
  };
  const appears = ((entryRows ?? []) as unknown as AppearRow[]).sort(
    (a, b) => a.position - b.position,
  );
  const best = appears[0];

  const listLengths = new Map<string, number>();
  if (appears.length) {
    const ids = [...new Set(appears.map(a => a.lists.id))];
    const { data: counts } = await supabase.from('list_entries').select('list_id').in('list_id', ids);
    for (const id of ids) listLengths.set(id, (counts ?? []).filter(c => c.list_id === id).length);
  }

  const qs = encodeURIComponent(`${item.artist_name} ${item.title}`);
  const links: [string, string][] = [
    [item.wikipedia_url ?? `https://en.wikipedia.org/w/index.php?search=${qs}`, 'Wikipedia'],
    [
      `https://musicbrainz.org/${item.kind === 'album' ? 'release-group' : 'recording'}/${item.mbid}`,
      'MusicBrainz',
    ],
    [item.discogs_url ?? `https://www.discogs.com/search/?q=${qs}`, 'Discogs'],
    [`https://bandcamp.com/search?q=${qs}`, 'Bandcamp'],
  ];

  const yr = fmtYear(item.year);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="flex flex-wrap gap-6 rounded-card border border-hairline bg-card p-6 text-ink">
        <Cover
          src={item.cover_url}
          title={item.title}
          artist={item.artist_name}
          className="zine w-[min(240px,60vw)] flex-none rounded-card"
          size={500}
          sizes="min(240px, 60vw)"
          priority
        />
        <div className="min-w-[220px] flex-1">
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-secondary">
            {item.kind}
            {yr ? ` · ${yr}` : ''}
          </p>
          <h1 className="mt-1 font-display text-3xl sm:text-4xl break-words">{item.title}</h1>
          <p className="mt-1 text-lg font-semibold">
            <ArtistLink name={item.artist_name} mbid={item.artist_mbid} />
          </p>
          {item.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {item.tags.map(t => (
                <Link
                  key={t}
                  href={`/explore?kind=${item.kind}&tag=${encodeURIComponent(t)}`}
                  className="rounded-chip border border-hairline px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide text-secondary hover:border-ink hover:text-ink"
                >
                  {t}
                </Link>
              ))}
            </div>
          )}

          <div className="mt-6 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="min-w-[104px] font-mono text-[10px] uppercase tracking-[0.16em] text-secondary">
                Community
              </span>
              <Stars value={avg} size={16} />
              <span className="font-mono text-[13px] tabular-nums">
                {ratings.length ? `${fmtRating(avg)} · ${fmtCount(ratings.length, 'rating')}` : '— · no ratings yet'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="min-w-[104px] font-mono text-[10px] uppercase tracking-[0.16em] text-secondary">
                Your rating
              </span>
              {user ? (
                <>
                  <RateControl itemMbid={mbid} initial={mine} />
                  <span className="font-mono text-[13px] tabular-nums">
                    {mine ? fmtRating(mine) : 'tap a star — halves count'}
                  </span>
                </>
              ) : (
                <Link href="/login" className="font-mono text-[13px] text-cobalt underline underline-offset-4">
                  Sign in to rate
                </Link>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {links.map(([href, label]) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-chip border border-hairline px-3.5 py-2.5 font-mono text-[11px] uppercase tracking-wide hover:border-cobalt hover:text-cobalt"
              >
                {label} ↗
              </a>
            ))}
            {user && <PinButton itemMbid={mbid} pinned={pinned} />}
          </div>
        </div>
      </div>

      <div className={`mt-6 grid gap-6 ${item.kind === 'album' ? 'md:grid-cols-2' : ''}`}>
        {item.kind === 'album' && (
          <section className="rounded-card border border-hairline bg-card p-5 text-ink">
            <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.16em] text-secondary">
              Tracklist
            </h2>
            {tracks.length ? (
              <ol>
                {tracks.map((t, i) => (
                  <li
                    key={i}
                    className="flex items-baseline gap-3 border-b border-hairline py-2 text-sm last:border-0"
                  >
                    <span className="w-6 flex-none text-right font-mono text-[11px] tabular-nums text-secondary">
                      {t.pos}
                    </span>
                    <span className="min-w-0 flex-1 break-words">{t.title}</span>
                    <span className="flex-none font-mono text-[11px] tabular-nums text-secondary">
                      {msToLen(t.len)}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="font-mono text-sm text-secondary">
                {tracklistNote ?? 'No tracklist on file for this release.'}
              </p>
            )}
          </section>
        )}

        <section>
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-cobalt">
            Appears in {fmtCount(new Set(appears.map(a => a.lists.id)).size, 'list')}
          </p>
          {appears.length ? (
            <>
              {best && (
                <div className="mb-3 flex items-center gap-5 rounded-card border border-hairline bg-card p-5 text-ink">
                  <Rank
                    pos={best.position}
                    max={listLengths.get(best.lists.id) ?? best.position}
                    label="best position"
                    size="lg"
                    sticker
                  />
                  <p className="max-w-[30ch] text-sm text-secondary">
                    Its highest placing across all published lists.
                  </p>
                </div>
              )}
              <div className="divide-y divide-hairline rounded-card border border-hairline bg-card py-1 text-ink">
                {appears.map((a, i) => (
                  <Link
                    key={`${a.lists.id}-${i}`}
                    href={`/list/${a.lists.id}`}
                    className="group flex items-center gap-3 px-4 py-3"
                  >
                    <Rank pos={a.position} max={listLengths.get(a.lists.id) ?? a.position} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold group-hover:text-cobalt">
                        {a.lists.title}
                      </span>
                      <span className="block font-mono text-xs text-secondary">
                        by @{a.lists.profiles?.username ?? 'unknown'} ·{' '}
                        {fmtCount(listLengths.get(a.lists.id) ?? 0, 'entry', 'entries')}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-card border border-hairline bg-card p-8 text-center text-ink">
              <h3 className="font-display text-lg">Not on any list yet</h3>
              <p className="mt-1 text-sm text-secondary">Put it somewhere — that’s the whole point.</p>
              <Link
                href="/lists/new"
                className="mt-4 inline-block rounded-chip bg-cobalt px-4 py-2.5 font-mono text-xs font-semibold uppercase tracking-wider text-paper"
              >
                Start a list
              </Link>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
