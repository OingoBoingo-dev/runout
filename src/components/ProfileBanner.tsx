/**
 * Decorative profile-header backdrop: a horizontal strip of already-resolved
 * cover URLs, heavily blurred and washed with a paper gradient so ink text
 * layered on top stays legible (gradient is strongest at the bottom/left,
 * where the display name sits). Renders nothing when no covers resolve, so
 * the page falls back to today's flat-paper look. Fixed-height, absolutely
 * positioned box — zero layout shift whether or not images load.
 */
export function ProfileBanner({ covers }: { covers: (string | null)[] }) {
  const urls = covers.filter((c): c is string => Boolean(c)).slice(0, 5);
  if (!urls.length) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-[118px] overflow-hidden rounded-card sm:h-[150px]"
    >
      <div className="flex h-full w-full scale-110 opacity-60 blur-[24px] saturate-[0.85]">
        {urls.map((url, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={url}
            alt=""
            aria-hidden
            loading="lazy"
            className="h-full min-w-0 flex-1 object-cover"
          />
        ))}
      </div>
      {/* Paper wash: vertical fade keeps the lower band near-solid paper… */}
      <div className="absolute inset-0 bg-gradient-to-t from-paper via-paper/70 to-paper/25" />
      {/* …and a left-weighted fade protects the name/handle column. */}
      <div className="absolute inset-0 bg-gradient-to-r from-paper/80 via-paper/35 to-transparent" />
    </div>
  );
}
