import { fmtPos } from '@/lib/format';

/** Signature element: oversized zero-padded rank numeral + mono sublabel. */
export function Rank({
  pos,
  max,
  label = 'pos',
  size = 'md',
  accent = false,
}: {
  pos: number;
  max: number;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  accent?: boolean;
}) {
  const numeral =
    size === 'lg' ? 'text-5xl' : size === 'sm' ? 'text-xl' : 'text-3xl';
  const width = size === 'lg' ? 'min-w-[88px]' : size === 'sm' ? 'min-w-[44px]' : 'min-w-[56px]';
  return (
    <span className={`flex ${width} flex-none flex-col items-center px-1`}>
      <b
        className={`font-display font-normal leading-[0.95] tracking-tight tabular-nums ${numeral} ${
          accent ? 'text-accent' : ''
        }`}
      >
        {fmtPos(pos, max)}
      </b>
      <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-ink2">
        {label}
      </span>
    </span>
  );
}
