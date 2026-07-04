import type { Metadata } from 'next';
import Link from 'next/link';
import { Cover } from '@/components/Cover';
import { getChart, getTrending } from '@/lib/data';
import { fmtCount, fmtInt, fmtPos, fmtYear } from '@/lib/format';

export const metadata: Metadata = { title: 'Explore' };

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

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
            The Chart
          </p>
          <h1 className="font-display text-3xl sm:text-4xl">Community Top 50</h1>
          <p className="mt-2 max-w-xl text-muted">
            Every published {kind} list feeds one ledger: score = Σ (1000 − position). Ties break
            on list count, then alphabetically.
          </p>
        </div>
        <div className="flex rounded-[13px] border border-paper/10 bg-paper/5 p-1" role="group" aria-label="Chart type">
          {(['album', 'song'] as const).map(k => (
            <Link
              key={k}
              href={hrefFor({ kind: k, tag: undefined })}
              aria-current={kind === k}
              className={`rounded-chip px-5 py-2 font-mono text-xs uppercase tracking-wider ${
                kind === k ? 'bg-paper font-semibold text-ink' : 'text-muted hover:text-paper'
              }`}
            >
              {k}s
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">
        <Link
          href={hrefFor({ tag: undefined })}
          className={`flex-none rounded-chip border px-3.5 py-2 font-mono text-[11px] uppercase tracking-wide ${
            !tag ? 'border-accent bg-accent font-semibold text-press' : 'border-paper/15 text-muted hover:text-paper'
          }`}
        >
          All tags
        </Link>
        {tags.map(t => (
          <Link
            key={t}
            href={hrefFor({ tag: t })}
            className={`flex-none rounded-chip border px-3.5 py-2 font-mono text-[11px] uppercase tracking-wide ${
              tag === t ? 'border-accent bg-accent font-semibold text-press' : 'border-paper/15 text-muted hover:text-paper'
            }`}
          >
            {t}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="mt-6 rounded-card bg-paper p-10 text-center text-ink">
          <h2 className="font-display text-xl">Nothing charting yet</h2>
          <p className="mt-2 text-ink2">
            Publish a {kind} list and it starts scoring immediately.
          </p>
          <Link
            href="/lists/new"
            className="mt-5 inline-block rounded-chip bg-accent px-5 py-3 font-mono text-xs font-semibold uppercase tracking-wider text-press"
          >
            Start a list
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {rows.map((r, i) => (
            <Link key={r.mbid} href={`/item/${r.mbid}`} className="group block min-w-0">
              <span className="relative block">
                <Cover src={r.cover_url} title={r.title} artist={r.artist_name} className="w-full rounded-card" />
                <span className="absolute left-2 top-2 rounded-chip border border-paper/10 bg-ink/60 px-2.5 py-1.5 font-display text-[15px] leading-none text-paper backdrop-blur-sm tabular-nums">
                  {fmtPos(i + 1, Math.min(rows.length, 50))}
                </span>
              </span>
              <span className="mt-2 block truncate text-sm font-semibold group-hover:text-accent">
                {r.title}
              </span>
              <span className="block truncate font-mono text-[11px] tabular-nums text-muted">
                {r.artist_name}
                {fmtYear(r.year) ? ` · ${fmtYear(r.year)}` : ''}
              </span>
              <span className="block truncate font-mono text-[11px] tabular-nums text-muted">
                {fmtInt(r.score)} · in {fmtCount(r.list_count, 'list')}
              </span>
            </Link>
          ))}
        </div>
      )}

      <section className="mt-10">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
          Trending lists
        </p>
        {trending.length === 0 ? (
          <p className="text-muted">
            No published lists yet.{' '}
            <Link href="/lists/new" className="font-mono text-accent underline underline-offset-4">
              Publish the first one
            </Link>
          </p>
        ) : (
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3 [scrollbar-width:none]">
            {trending.map(t => (
              <Link
                key={t.list.id}
                href={`/list/${t.list.id}`}
                className="group w-[190px] flex-none snap-start rounded-card bg-paper p-2.5 text-ink"
              >
                <span className="grid grid-cols-2 gap-0.5 overflow-hidden rounded-chip">
                  {(t.covers.length ? t.covers : [null]).slice(0, 4).map((c, i) => (
                    <Cover key={i} src={c} title={t.titles[i] ?? t.list.title} artist="" className="w-full rounded-none" />
                  ))}
                </span>
                <span className="mt-2.5 block font-display text-[15px] leading-tight group-hover:text-accent">
                  {t.list.title}
                </span>
                <span className="mt-1 block font-mono text-[11px] tabular-nums text-ink2">
                  @{t.owner.username} · {fmtCount(t.likeCount, 'like')}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
