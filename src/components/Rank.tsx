import { formatPosition } from '@/lib/format';

/**
 * Signature element: oversized zero-padded rank numeral + mono sublabel.
 * `sticker` renders the yellow hype-sticker treatment (ink numeral on a
 * rounded yellow chip with a whisper of shadow) — top-3 list rows and the
 * item page's best position only.
 */
export function Rank({
  pos,
  max,
  label = 'pos',
  size = 'md',
  sticker = false,
}: {
  pos: number;
  max: number;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  sticker?: boolean;
}) {
  const numeral = size === 'lg' ? 'text-5xl' : size === 'sm' ? 'text-xl' : 'text-3xl';
  const width = size === 'lg' ? 'min-w-[88px]' : size === 'sm' ? 'min-w-[44px]' : 'min-w-[56px]';
  const chipPad = size === 'lg' ? 'px-3 py-2' : size === 'sm' ? 'px-1.5 py-1' : 'px-2 py-1.5';
  return (
    <span className={`flex ${width} flex-none flex-col items-center px-1`}>
      <b
        className={`font-display font-normal leading-[0.95] tracking-tight text-ink tabular-nums ${numeral} ${
          sticker
            ? `rounded-chip bg-yellow ${chipPad} shadow-[0_1px_4px_rgba(22,21,15,0.25)]`
            : ''
        }`}
      >
        {formatPosition(pos, max)}
      </b>
      <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-secondary">
        {label}
      </span>
    </span>
  );
}
