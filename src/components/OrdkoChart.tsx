import Link from 'next/link';
import { ArtistLink } from '@/components/ArtistLink';
import { Cover } from '@/components/Cover';
import { fmtInt, fmtYear, plural } from '@/lib/format';
import type { OrdkoRow } from '@/lib/ordko-lists';

/**
 * Presentational: renders one compiled Ordko chart's rows as a ranked list.
 * Server component — pure presentation, no state (the page owns the toggles).
 * Mobile-first (375px): a single column of rank · cover · title/artist/year ·
 * mono score caption. Yellow hype-sticker rank numeral to match The Chart.
 *
 * Whole-row navigation via the stretched-link pattern: the row is `relative`,
 * an `absolute inset-0` overlay Link (z-[1], above the positioned Cover)
 * carries the accessible name, and the artist link sits at z-10 so it stays
 * independently clickable. Title is plain text — the overlay owns navigation.
 */
export function OrdkoChart({ rows, eagerRows = 0 }: { rows: OrdkoRow[]; eagerRows?: number }) {
  const max = rows.length ? rows[rows.length - 1].rank : 0;
  return (
    <ol className="mt-6 space-y-2">
      {rows.map((r, i) => (
        <li
          key={r.mbid}
          className="press group relative flex items-center gap-3 rounded-card border border-hairline bg-card p-2.5"
        >
          <Link
            href={`/item/${r.mbid}`}
            aria-label={r.title}
            className="absolute inset-0 z-[1] rounded-card"
          />
          {/* Yellow rank sticker — ink Archivo numeral, whisper of shadow. */}
          <span className="grid min-w-[44px] flex-none place-items-center">
            <b className="rounded-chip bg-yellow px-2 py-1.5 font-display text-xl font-normal leading-none tabular-nums text-ink shadow-[0_1px_4px_rgba(22,21,15,0.25)]">
              {String(r.rank).padStart(String(Math.max(2, max)).length, '0')}
            </b>
          </span>

          <Cover
            src={r.cover_url}
            title={r.title}
            artist={r.artist_name}
            rounded="rounded-chip"
            className="w-14 flex-none"
            priority={i < eagerRows}
          />

          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold group-hover:text-cobalt">
              {r.title}
            </span>
            <span className="block truncate font-mono text-[11px] text-secondary">
              <ArtistLink name={r.artist_name} mbid={r.artist_mbid} className="relative z-10" />
              {fmtYear(r.year) ? ` · ${fmtYear(r.year)}` : ''}
            </span>
            <span className="block truncate font-mono text-[11px] text-secondary">
              {fmtInt(r.score)} · in {plural(r.listCount, 'list')}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
