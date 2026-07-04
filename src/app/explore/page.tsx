import type { Metadata } from 'next';
import Link from 'next/link';
import { Cover } from '@/components/Cover';
import { getChart, getTrending } from '@/lib/data';
import { formatPosition, formatScore, formatYear, plural } from '@/lib/format';
import { quartetTint } from '@/lib/placeholder';

export const metadata: Metadata = { title: 'Explore' };

const HeartIcon = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 21s-7.5-4.9-10-9.3C.4 8.7 2.4 5 6 5c2.2 0 3.7 1.2 4.6 2.6l1.4 2 1.4-2C14.3 6.2 15.8 5 18 5c3.6 0 5.6 3.7 4 6.7C19.5 16.1 12 21 12 21z" />
  </svg>
);

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; tag?: string }>;
}) {
  const sp = await searchParams;
  const kind = sp.kind === 'song' ? 'song' : 'album';
  const tag = (sp.tag ?? '').trim() || undefined;

  const [rows, trending] = await Promise.all([getChart(kind, tag), getTrending()]);

  const tagFreq = new Map<string, number>();
  for (const r of rows) for (const t of r.tags ?? []) tagFreq.set(t, (tagFreq.get(t) ?? 0) + 1);
  const tags = [...tagFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([t]) => t);
  if (tag && !tags.includes(tag)) tags.push(tag);

  const hrefFor = (params: { kind?: string; tag?: string }) => {
    const q = new URLSearchParams();
    const k = params.kind ?? kind;
    if (k !== 'album') q.set('kind', k);
    if (params.tag) q.set('tag', params.tag);
    const s = q.toString();
    return s ? `/explore?${s}` : '/explore';
  };

  const wall = rows.slice(0, 10);

  return (
    <div>
      {/* Hero — "The Wall": edge-to-edge gapless mosaic scrolling under the glass bar. */}
      {wall.length > 0 && (
        <div className="-mt-[calc(56px+env(safe-area-inset-top))] grid grid-cols-5">
          {wall.map(r => (
            <Link key={r.mbid} href={`/item/${r.mbid}`} aria-label={r.title} className="block">
              <Cover src={r.cover_url} title={r.title} artist={r.artist_name} rounded="rounded-none" className="w-full" />
            </Link>
          ))}
        </div>
      )}

      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-secondary">
              The Chart
            </p>
            <h1 className="font-display text-3xl sm:text-4xl">Community Top 50</h1>
            <p className="mt-2 max-w-xl text-secondary">
              Every published {kind} list feeds one ledger: score = Σ (1000 − position). Ties
              break on list count, then alphabetically.
            </p>
          </div>
          {/* Segmented control: yellow track, cobalt thumb. */}
          <div className="flex rounded-[13px] bg-yellow p-1" role="group" aria-label="Chart type">
            {(['album', 'song'] as const).map(k => (
              <Link
                key={k}
                href={hrefFor({ kind: k, tag: undefined })}
                aria-current={kind === k}
                className={`press rounded-chip px-5 py-2 font-mono text-xs font-semibold uppercase tracking-wider ${
                  kind === k ? 'bg-cobalt text-paper' : 'text-ink hover:brightness-95'
                }`}
              >
                {k}s
              </Link>
            ))}
          </div>
        </div>

        {/* Genre lens — pills tinted deterministically from the quartet. */}
        <div className="no-scrollbar mt-5 flex snap-x gap-2 overflow-x-auto pb-2">
          <Pill href={hrefFor({ tag: undefined })} active={!tag} label="All tags" tintKey="__all__" />
          {tags.map(t => (
            <Pill key={t} href={hrefFor({ tag: t })} active={tag === t} label={t} tintKey={t} />
          ))}
        </div>

        {rows.length === 0 ? (
          <div className="mt-6 rounded-card border border-hairline bg-card p-10 text-center">
            <h2 className="font-display text-xl">Nothing charting yet</h2>
            <p className="mt-2 text-secondary">
              Publish a {kind} list and it starts scoring immediately.
            </p>
            <Link
              href="/lists/new"
              className="press mt-5 inline-block rounded-chip bg-yellow px-5 py-3 font-mono text-xs font-semibold uppercase tracking-wider text-ink"
            >
              Start a list
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {rows.map((r, i) => (
              <Link key={r.mbid} href={`/item/${r.mbid}`} className="press group block min-w-0">
                <span className="relative block">
                  <Cover src={r.cover_url} title={r.title} artist={r.artist_name} rounded="rounded-card" className="zine w-full" />
                  {/* Yellow hype-sticker rank chip: ink Archivo numeral, whisper of shadow. */}
                  <span className="absolute left-2 top-2 rounded-full bg-yellow px-2.5 py-1.5 font-display text-[15px] leading-none text-ink shadow-[0_1px_4px_rgba(22,21,15,0.25)] tabular-nums">
                    {formatPosition(i + 1, Math.min(rows.length, 50))}
                  </span>
                </span>
                <span className="mt-2 block truncate text-sm font-semibold group-hover:text-cobalt">
                  {r.title}
                </span>
                <span className="block truncate font-mono text-[11px] text-secondary">
                  {r.artist_name}
                  {formatYear(r.year) ? ` · ${formatYear(r.year)}` : ''}
                </span>
                <span className="block truncate font-mono text-[11px] text-secondary">
                  {formatScore(r.score)} · in {plural(r.list_count, 'list')}
                </span>
              </Link>
            ))}
          </div>
        )}

        <section className="mt-10">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-secondary">
            Trending lists
          </p>
          {trending.length === 0 ? (
            <p className="text-secondary">
              No published lists yet.{' '}
              <Link href="/lists/new" className="font-mono text-cobalt underline underline-offset-4">
                Publish the first one
              </Link>
            </p>
          ) : (
            <div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3">
              {trending.map(t => (
                <Link
                  key={t.list.id}
                  href={`/list/${t.list.id}`}
                  className="press group w-[190px] flex-none snap-start rounded-card border border-hairline bg-card p-2.5"
                >
                  <span className="zine-sm grid grid-cols-2 gap-0.5 overflow-hidden rounded-chip">
                    {(t.covers.length ? t.covers : [null]).slice(0, 4).map((c, i) => (
                      <Cover key={i} src={c} title={t.titles[i] ?? t.list.title} artist="" rounded="rounded-none" className="w-full" />
                    ))}
                  </span>
                  <span className="mt-2.5 block font-display text-[15px] leading-tight group-hover:text-cobalt">
                    {t.list.title}
                  </span>
                  <span className="mt-1 flex items-center gap-1.5 font-mono text-[11px] text-secondary">
                    @{t.owner.username} ·{' '}
                    <span className="inline-flex items-center gap-1 text-red">
                      {HeartIcon} {formatScore(t.likeCount)}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Pill({
  href,
  active,
  label,
  tintKey,
}: {
  href: string;
  active: boolean;
  label: string;
  tintKey: string;
}) {
  const { bg, fg } =
    tintKey === '__all__' ? { bg: '#16150F', fg: '#FAF6EC' } : quartetTint(tintKey);
  return (
    <Link
      href={href as '/explore'}
      className={`press flex-none snap-start rounded-chip border px-3.5 py-2 font-mono text-[11px] uppercase tracking-wide ${
        active ? 'border-transparent font-semibold' : 'border-hairline bg-card text-ink hover:border-ink/30'
      }`}
      style={active ? { background: bg, color: fg } : undefined}
    >
      {!active && (
        <span aria-hidden className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: bg }} />
      )}
      {label}
    </Link>
  );
}
