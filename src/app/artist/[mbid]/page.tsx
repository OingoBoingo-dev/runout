import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Cover } from '@/components/Cover';
import { formatYear } from '@/lib/format';
import { fetchArtistDetail, MBBusyError } from '@/lib/mb';

/**
 * Read-only artist page. Header (name, type, disambiguation, external links) +
 * official discography as album cards linking to /item/{rg-mbid}. No follow
 * (schema-gated), no bootlegs. Graceful notFound() on bad mbid; MB-busy
 * fallback keeps the route from 500-ing.
 */
export default async function ArtistPage({ params }: { params: Promise<{ mbid: string }> }) {
  const { mbid } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(mbid)) notFound();

  let detail: Awaited<ReturnType<typeof fetchArtistDetail>>;
  try {
    detail = await fetchArtistDetail(mbid);
  } catch (err) {
    if (err instanceof MBBusyError) {
      return (
        <div className="mx-auto w-full max-w-3xl px-4 py-8">
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-cobalt">Artist</p>
          <h1 className="font-display text-3xl">Catalog is busy</h1>
          <p className="mt-3 font-mono text-sm text-secondary">
            MusicBrainz is rate-limited right now — give it a few seconds and reload.
          </p>
        </div>
      );
    }
    notFound();
  }

  const { artist, wikipedia_url, discogs_url, releaseGroups } = detail;

  const subtitle = [artist.type, artist.disambiguation || artist.area]
    .filter(Boolean)
    .join(' · ');

  const links: [string | null, string][] = [
    [`https://musicbrainz.org/artist/${artist.mbid}`, 'MusicBrainz'],
    [wikipedia_url, 'Wikipedia'],
    [discogs_url, 'Discogs'],
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="rounded-card border border-hairline bg-card p-6 text-ink">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-secondary">Artist</p>
        <h1 className="mt-1 font-display text-3xl sm:text-4xl break-words">{artist.name}</h1>
        {subtitle && <p className="mt-1 font-mono text-sm text-secondary">{subtitle}</p>}
        <div className="mt-5 flex flex-wrap gap-2">
          {links
            .filter((l): l is [string, string] => Boolean(l[0]))
            .map(([href, label]) => (
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
        </div>
      </div>

      <section className="mt-6">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-cobalt">
          Discography
        </p>
        {releaseGroups.length ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {releaseGroups.map(rg => {
              const yr = formatYear(rg.year);
              return (
                <Link key={rg.mbid} href={`/item/${rg.mbid}`} className="group block">
                  <Cover
                    src={rg.cover_url}
                    title={rg.title}
                    artist={rg.artist_name}
                    className="w-full rounded-card"
                    rounded="rounded-card"
                  />
                  <p className="mt-2 truncate font-semibold text-sm group-hover:text-cobalt">
                    {rg.title}
                  </p>
                  <p className="truncate font-mono text-[11px] tabular-nums text-secondary">
                    {[rg.primary_type ?? 'release', yr].filter(Boolean).join(' · ')}
                  </p>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="rounded-card border border-hairline bg-card p-8 text-center text-ink">
            <h3 className="font-display text-lg">No discography on file</h3>
            <p className="mt-1 text-sm text-secondary">
              MusicBrainz has no official release groups for this artist yet.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
