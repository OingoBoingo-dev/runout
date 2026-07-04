const STAR_PATH =
  'M12 17.3l-6.18 3.7 1.64-7.03L2 9.24l7.19-.61L12 2l2.81 6.63 7.19.61-5.46 4.73 1.64 7.03z';

function Star({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden className="block flex-none">
      <path fill="currentColor" d={STAR_PATH} />
    </svg>
  );
}

/** Read-only star row with half-star precision via width clipping. */
export function Stars({ value, size = 15 }: { value: number; size?: number }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  const label = value ? `${Math.round(value * 10) / 10} out of 5 stars` : 'Not yet rated';
  const five = [0, 1, 2, 3, 4];
  return (
    <span className="relative inline-flex align-middle text-ink/15" role="img" aria-label={label}>
      <span className="inline-flex">
        {five.map(i => (
          <Star key={i} size={size} />
        ))}
      </span>
      <span
        className="absolute left-0 top-0 inline-flex h-full overflow-hidden whitespace-nowrap text-cobalt"
        style={{ width: `${pct}%` }}
      >
        {five.map(i => (
          <Star key={i} size={size} />
        ))}
      </span>
    </span>
  );
}
