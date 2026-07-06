import type { Metadata } from 'next';
import Link from 'next/link';
import { OrdkoChart } from '@/components/OrdkoChart';
import { fmtInt, plural } from '@/lib/format';
import { getOrdkoBuckets, getOrdkoList } from '@/lib/ordko-lists';
import { quartetTint } from '@/lib/placeholder';
import type { Kind } from '@/lib/types';

const N_CHOICES = [10, 20, 50, 100] as const;
const DEFAULT_N = 50;
const DEFAULT_GENRE = 'all time';

function parseKind(v: string | undefined): Kind {
  return v === 'song' ? 'song' : 'album';
}
function parseN(v: string | undefined): number {
  const n = Number(v);
  return (N_CHOICES as readonly number[]).includes(n) ? n : DEFAULT_N;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; genre?: string; n?: string }>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const kind = parseKind(sp.kind);
  const genre = (sp.genre ?? '').trim();
  const title = genre
    ? `Ordko · ${genre} ${kind}s`
    : 'Ordko Lists — community compilation charts';
  const description = genre
    ? `The community's collective ${kind} ranking for ${genre}, compiled from every published list.`
    : 'Compilation charts pooled from every published list — the community’s collective ranking.';
  return { title, description, openGraph: { title, description } };
}

export default async function OrdkoPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; genre?: string; n?: string }>;
}) {
  const sp = await searchParams;
  const kind = parseKind(sp.kind);
  const n = parseN(sp.n);
  const requestedGenre = (sp.genre ?? '').trim();

  const buckets = await getOrdkoBuckets({ minLists: 1 });
  const bucketsForKind = buckets.filter(b => b.kind === kind);

  // Resolve the active genre: explicit request wins (even if thin); else the
  // flagship 'all time' bucket if present; else the fattest bucket for this kind.
  const flagship = bucketsForKind.find(b => b.genre === DEFAULT_GENRE);
  const activeGenre =
    requestedGenre || flagship?.genre || bucketsForKind[0]?.genre || DEFAULT_GENRE;

  const chart = await getOrdkoList({ kind, genre: activeGenre, limit: n });

  const hrefFor = (params: { kind?: Kind; genre?: string; n?: number }) => {
    const q = new URLSearchParams();
    const k = params.kind ?? kind;
    const g = params.genre ?? activeGenre;
    const nn = params.n ?? n;
    if (k !== 'album') q.set('kind', k);
    if (g) q.set('genre', g);
    if (nn !== DEFAULT_N) q.set('n', String(nn));
    const s = q.toString();
    return s ? `/ordko?${s}` : '/ordko';
  };

  const hasBuckets = bucketsForKind.length > 0;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-secondary">
            Ordko Lists
          </p>
          <h1 className="font-display text-3xl sm:text-4xl">
            {activeGenre} {kind}s
          </h1>
          <p className="mt-2 max-w-xl text-secondary">
            {chart.totalLists > 0 ? (
              <>
                Compiled from {plural(chart.totalLists, 'published list')} — the community&rsquo;s
                collective ranking. Score = &Sigma; (1000 &minus; position) pooled across every
                list size; ties break on list count, then title.
              </>
            ) : (
              <>
                Community compilation charts — every published list of this cut is pooled into one
                collective ranking.
              </>
            )}
          </p>
        </div>

        {/* Kind toggle: yellow track, cobalt thumb (matches The Chart). */}
        <div className="flex rounded-[13px] bg-yellow p-1" role="group" aria-label="Chart kind">
          {(['album', 'song'] as const).map(k => (
            <Link
              key={k}
              href={hrefFor({ kind: k, genre: requestedGenre || undefined })}
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

      {/* Genre chooser — only buckets that actually have published lists. */}
      {hasBuckets && (
        <div className="no-scrollbar mt-5 flex snap-x gap-2 overflow-x-auto pb-2">
          {bucketsForKind.map(b => (
            <GenrePill
              key={b.genre}
              href={hrefFor({ genre: b.genre })}
              active={activeGenre === b.genre}
              label={b.genre}
              count={b.listCount}
              tintKey={b.genre}
            />
          ))}
        </div>
      )}

      {/* N slice selector. */}
      <div className="mt-4 flex items-center gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-secondary">
          Top
        </span>
        <div className="flex rounded-chip border border-hairline bg-card p-0.5" role="group" aria-label="List size">
          {N_CHOICES.map(choice => (
            <Link
              key={choice}
              href={hrefFor({ n: choice })}
              aria-current={n === choice}
              className={`press rounded-chip px-3 py-1.5 font-mono text-[11px] font-semibold tabular-nums ${
                n === choice ? 'bg-cobalt text-paper' : 'text-ink hover:brightness-95'
              }`}
            >
              {choice}
            </Link>
          ))}
        </div>
      </div>

      {chart.rows.length === 0 ? (
        <div className="mt-6 rounded-card border border-hairline bg-card p-10 text-center">
          <h2 className="font-display text-xl">Not enough lists in this cut yet</h2>
          <p className="mt-2 text-secondary">
            No published {kind} lists tagged &ldquo;{activeGenre}&rdquo; have charted yet. Publish
            one and it feeds the compilation instantly.
          </p>
          <Link
            href="/lists/new"
            className="press mt-5 inline-block rounded-chip bg-yellow px-5 py-3 font-mono text-xs font-semibold uppercase tracking-wider text-ink"
          >
            Start a list
          </Link>
        </div>
      ) : (
        <OrdkoChart rows={chart.rows} />
      )}
    </div>
  );
}

function GenrePill({
  href,
  active,
  label,
  count,
  tintKey,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
  tintKey: string;
}) {
  const { bg, fg } = quartetTint(tintKey);
  return (
    <Link
      href={href as '/ordko'}
      className={`press flex-none snap-start rounded-chip border px-3.5 py-2 font-mono text-[11px] uppercase tracking-wide ${
        active ? 'border-transparent font-semibold' : 'border-hairline bg-card text-ink hover:border-ink/30'
      }`}
      style={active ? { background: bg, color: fg } : undefined}
    >
      {!active && (
        <span aria-hidden className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: bg }} />
      )}
      {label}
      <span className={`ml-1.5 tabular-nums ${active ? 'opacity-80' : 'text-secondary'}`}>
        {fmtInt(count)}
      </span>
    </Link>
  );
}
