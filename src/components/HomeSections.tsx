import Link from 'next/link';
import { ArtistLink } from '@/components/ArtistLink';
import { Cover } from '@/components/Cover';
import { Stars } from '@/components/Stars';
import type { FeedEntry, TrendingList } from '@/lib/data';
import { fmtInt, fmtRating, formatPosition, formatYear, timeAgo } from '@/lib/format';
import type { ChartRow } from '@/lib/types';

const HeartIcon = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 21s-7.5-4.9-10-9.3C.4 8.7 2.4 5 6 5c2.2 0 3.7 1.2 4.6 2.6l1.4 2 1.4-2C14.3 6.2 15.8 5 18 5c3.6 0 5.6 3.7 4 6.7C19.5 16.1 12 21 12 21z" />
  </svg>
);

const CommentIcon = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 9 9 0 0 1-4-1L3 20l1.5-5.5A8.38 8.38 0 0 1 12.5 3 8.5 8.5 0 0 1 21 11.5z" />
  </svg>
);

/** A shared section header: mono kicker + optional "see all" trailing link. */
export function SectionHead({
  kicker,
  title,
  href,
  linkLabel,
}: {
  kicker: string;
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-secondary">
          {kicker}
        </p>
        <h2 className="font-display text-2xl sm:text-3xl">{title}</h2>
      </div>
      {href && linkLabel && (
        <Link
          href={href as '/explore'}
          className="font-mono text-[11px] uppercase tracking-widest text-cobalt hover:underline hover:underline-offset-4"
        >
          {linkLabel} &rarr;
        </Link>
      )}
    </div>
  );
}

/**
 * A compact ranked mini-chart (top ~6-8): yellow rank sticker · cover · title/
 * artist. Mirrors The Chart's item cards but as a tight vertical list so two can
 * sit side by side on desktop. Whole row navigates to /item/{mbid} via a
 * stretched overlay Link (z-[1], above the positioned Cover); the artist name
 * is its own /artist link at z-10.
 */
export function MiniChart({ rows, eagerRows = 0 }: { rows: ChartRow[]; eagerRows?: number }) {
  const max = rows.length;
  return (
    <ol className="mt-4 space-y-2">
      {rows.map((r, i) => (
        <li
          key={r.mbid}
          className="press group relative flex items-center gap-3 rounded-card border border-hairline bg-card p-2"
        >
          <Link
            href={`/item/${r.mbid}`}
            aria-label={r.title}
            className="absolute inset-0 z-[1] rounded-card"
          />
          <span className="grid min-w-[40px] flex-none place-items-center">
            <b className="rounded-chip bg-yellow px-2 py-1.5 font-display text-lg font-normal leading-none tabular-nums text-ink shadow-[0_1px_4px_rgba(22,21,15,0.25)]">
              {formatPosition(i + 1, max)}
            </b>
          </span>
          <Cover
            src={r.cover_url}
            title={r.title}
            artist={r.artist_name}
            rounded="rounded-chip"
            className="w-12 flex-none"
            priority={i < eagerRows}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold group-hover:text-cobalt">
              {r.title}
            </span>
            <span className="block truncate font-mono text-[11px] text-secondary">
              <ArtistLink name={r.artist_name} mbid={r.artist_mbid} className="relative z-10" />
              {formatYear(r.year) ? ` · ${formatYear(r.year)}` : ''}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** A trending-list card: cover mosaic · title · @owner · likes/comments stat. */
export function TrendingCard({ t }: { t: TrendingList }) {
  return (
    <Link
      href={`/list/${t.list.id}`}
      className="press group flex-none snap-start rounded-card border border-hairline bg-card p-2.5"
    >
      <span className="zine-sm grid grid-cols-2 gap-0.5 overflow-hidden rounded-chip">
        {(t.covers.length ? t.covers : [null]).slice(0, 4).map((c, i) => (
          <Cover key={i} src={c} title={t.titles[i] ?? t.list.title} artist="" rounded="rounded-none" className="w-full" />
        ))}
      </span>
      <span className="mt-2.5 block font-display text-[15px] leading-tight group-hover:text-cobalt">
        {t.list.title}
      </span>
      <span className="mt-1 block truncate font-mono text-[11px] text-secondary">
        @{t.owner.username}
      </span>
      <span className="mt-1 flex items-center gap-2.5 font-mono text-[11px] text-secondary">
        <span className="inline-flex items-center gap-1 text-red">
          {HeartIcon} {fmtInt(t.likeCount)}
        </span>
        <span className="inline-flex items-center gap-1">
          {CommentIcon} {fmtInt(t.commentCount)}
        </span>
      </span>
    </Link>
  );
}

/** Compact following-feed row — condensed from the old full-page feed. */
export function FeedRow({ f }: { f: FeedEntry }) {
  const { activity: a, actor } = f;
  const tag =
    a.verb === 'publish' ? 'list' : a.verb === 'rate' ? 'rated' : a.verb === 'follow' ? 'follow' : 'comment';
  return (
    <article className="flex items-start gap-3 py-3">
      <span className="mt-1.5 flex-none rounded-full border border-hairline px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-secondary">
        {tag}
      </span>
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm">
          <Link href={`/u/${actor.username}`} className="font-semibold hover:text-cobalt">
            {actor.display_name || actor.username}
          </Link>{' '}
          {a.verb === 'publish' && f.list && (
            <>
              published{' '}
              <Link href={`/list/${f.list.id}`} className="font-semibold hover:text-cobalt">
                {f.list.title}
              </Link>
            </>
          )}
          {a.verb === 'rate' && f.item && (
            <>
              rated{' '}
              <Link href={`/item/${f.item.mbid}`} className="font-semibold hover:text-cobalt">
                {f.item.title}
              </Link>{' '}
              <Stars value={f.ratingValue ?? 0} size={13} />{' '}
              <span className="font-mono text-sm text-secondary">{fmtRating(f.ratingValue)}</span>
            </>
          )}
          {a.verb === 'follow' && f.targetProfile && (
            <>
              followed{' '}
              <Link href={`/u/${f.targetProfile.username}`} className="font-semibold hover:text-cobalt">
                {f.targetProfile.display_name || f.targetProfile.username}
              </Link>
            </>
          )}
          {a.verb === 'comment' && f.comment && (
            <>
              commented on{' '}
              <Link href={`/list/${f.comment.list_id}`} className="font-semibold hover:text-cobalt">
                {f.comment.listTitle}
              </Link>
            </>
          )}
        </p>
        {a.verb === 'comment' && f.comment && (
          <p className="mt-1 break-words text-sm italic text-secondary">
            &ldquo;{f.comment.body.length > 120 ? f.comment.body.slice(0, 118) + '…' : f.comment.body}&rdquo;
          </p>
        )}
      </div>
      {a.verb === 'rate' && f.item && (
        <Link href={`/item/${f.item.mbid}`} className="flex-none">
          <Cover src={f.item.cover_url} title={f.item.title} artist={f.item.artist_name} className="w-10" />
        </Link>
      )}
      <time className="mt-1.5 flex-none font-mono text-[11px] tabular-nums text-secondary">
        {timeAgo(a.created_at)}
      </time>
    </article>
  );
}
