import Link from 'next/link';

/**
 * An artist name that deep-links to /artist/{mbid} when the MBID is known and
 * degrades to a plain <span> when it isn't — NEVER a dead link. Inherits the
 * surrounding type styling; the link variant adds the standard cobalt hover.
 *
 * Inside a stretched-link row (row covered by an `absolute inset-0` overlay
 * Link) pass `relative z-10` via className so the name stays independently
 * clickable above the row's overlay.
 */
export function ArtistLink({
  name,
  mbid,
  className,
}: {
  name: string;
  mbid: string | null;
  className?: string;
}) {
  if (!mbid) return <span className={className}>{name}</span>;
  return (
    <Link
      href={`/artist/${mbid}`}
      className={`hover:text-cobalt${className ? ` ${className}` : ''}`}
    >
      {name}
    </Link>
  );
}
