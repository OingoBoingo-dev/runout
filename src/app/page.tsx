import Link from 'next/link';
import { FeedRow, MiniChart, SectionHead, TrendingCard } from '@/components/HomeSections';
import { OrdkoChart } from '@/components/OrdkoChart';
import { getChart, getFeed, getTrending } from '@/lib/data';
import { getOrdkoList } from '@/lib/ordko-lists';
import { currentUser } from '@/lib/supabase/server';

export default async function HomePage() {
  const user = await currentUser();

  // All independent reads in parallel. The following feed only runs when signed in.
  const [albums, songs, trending, ordko, feed] = await Promise.all([
    getChart('album'),
    getChart('song'),
    getTrending(),
    getOrdkoList({ kind: 'album', genre: 'all time', limit: 10 }),
    user ? getFeed(user.id) : Promise.resolve([]),
  ]);

  // Trending categories: tally genres across the hot lists' `genres` arrays.
  const genreFreq = new Map<string, number>();
  for (const t of trending) for (const g of t.list.genres ?? []) genreFreq.set(g, (genreFreq.get(g) ?? 0) + 1);
  const genres = [...genreFreq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([g]) => g);

  const topAlbums = albums.slice(0, 8);
  const topSongs = songs.slice(0, 8);
  const trendingLists = trending.slice(0, 6);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      {/* 1 · Header/intro — sells the product when signed out, warmer when signed in. */}
      <header>
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-cobalt">Home</p>
        {user ? (
          <>
            <h1 className="font-display text-3xl sm:text-5xl">Welcome back</h1>
            <p className="mt-3 max-w-2xl text-secondary">
              Here&rsquo;s what&rsquo;s moving on the charts and in your crates today.
            </p>
          </>
        ) : (
          <>
            <h1 className="max-w-3xl font-display text-3xl leading-[1.05] sm:text-5xl">
              Where music taste becomes identity — build the ranked lists that say who you are.
            </h1>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href="/signup"
                className="press rounded-chip bg-cobalt px-5 py-3 font-mono text-xs font-semibold uppercase tracking-wider text-paper hover:brightness-110"
              >
                Create your first list
              </Link>
              <Link
                href="/explore"
                className="font-mono text-xs uppercase tracking-widest text-cobalt hover:underline hover:underline-offset-4"
              >
                Browse the charts &rarr;
              </Link>
            </div>
          </>
        )}
      </header>

      {/* 2 · (signed-in only) Following feed — compact "Fresh from the crates". */}
      {user && (
        <section className="mt-10">
          <SectionHead kicker="Following" title="Fresh from the crates" />
          {feed.length === 0 ? (
            <p className="mt-4 text-secondary">
              Follow a few collectors and their lists, ratings and comments land here.{' '}
              <Link href="/explore" className="font-mono text-cobalt underline underline-offset-4">
                Find people to follow
              </Link>
            </p>
          ) : (
            <div className="mt-3 divide-y divide-hairline">
              {feed.slice(0, 8).map(f => (
                <FeedRow key={f.activity.id} f={f} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* 3 · Top ranked — two mini-charts side by side on desktop, stacked on mobile. */}
      {(topAlbums.length > 0 || topSongs.length > 0) && (
        <section className="mt-12">
          <SectionHead kicker="The Chart" title="Top ranked" />
          <div className="mt-2 grid gap-x-8 gap-y-6 md:grid-cols-2">
            {topAlbums.length > 0 && (
              <div>
                <div className="flex items-baseline justify-between">
                  <h3 className="font-display text-lg">Top Albums</h3>
                  <Link
                    href="/explore"
                    className="font-mono text-[11px] uppercase tracking-widest text-cobalt hover:underline hover:underline-offset-4"
                  >
                    See the full chart &rarr;
                  </Link>
                </div>
                <MiniChart rows={topAlbums} />
              </div>
            )}
            {topSongs.length > 0 && (
              <div>
                <div className="flex items-baseline justify-between">
                  <h3 className="font-display text-lg">Top Songs</h3>
                  <Link
                    href="/explore?kind=song"
                    className="font-mono text-[11px] uppercase tracking-widest text-cobalt hover:underline hover:underline-offset-4"
                  >
                    See the full chart &rarr;
                  </Link>
                </div>
                <MiniChart rows={topSongs} />
              </div>
            )}
          </div>
        </section>
      )}

      {/* 4 · Trending categories — genres tallied from the hot lists, as cobalt chips. */}
      {genres.length > 0 && (
        <section className="mt-12">
          <SectionHead kicker="What's hot" title="Trending categories" />
          <div className="mt-4 flex flex-wrap gap-2">
            {genres.map(g => (
              <Link
                key={g}
                href={`/ordko?kind=album&genre=${encodeURIComponent(g)}`}
                className="press rounded-chip border border-cobalt/25 bg-cobalt/10 px-3.5 py-2 font-mono text-[11px] uppercase tracking-wide text-cobalt hover:bg-cobalt/15"
              >
                {g}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 5 · Trending lists — engagement proxy; top ~6 hot lists as cards. */}
      {trendingLists.length > 0 && (
        <section className="mt-12">
          <SectionHead kicker="Moving today" title="Trending lists" />
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
            {trendingLists.map(t => (
              <TrendingCard key={t.list.id} t={t} />
            ))}
          </div>
        </section>
      )}

      {/* 6 · Ordko lists teaser — one flagship compiled chart + browse-all link. */}
      <section className="mt-12">
        <SectionHead
          kicker="Ordko Lists"
          title="The community's collective ranking"
          href="/ordko"
          linkLabel="Browse all Ordko lists"
        />
        <p className="mt-2 max-w-2xl text-secondary">
          Ordko lists — the community&rsquo;s collective ranking, compiled from every public list.
        </p>
        {ordko.rows.length > 0 ? (
          <OrdkoChart rows={ordko.rows} />
        ) : (
          <p className="mt-4 text-secondary">
            No compiled chart yet.{' '}
            <Link href="/ordko" className="font-mono text-cobalt underline underline-offset-4">
              Explore Ordko lists
            </Link>
          </p>
        )}
      </section>
    </div>
  );
}
