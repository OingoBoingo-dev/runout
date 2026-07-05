import type { CSSProperties, ReactNode } from 'react';

/**
 * Avatar frames — vinyl-culture profile borders (Crate's 12 concepts, built
 * to the engineering spec): designed in an 80x80 viewBox, avatar clipped to
 * the r=32 circle at (40,40), frame art living in the r=32–38.5 annulus,
 * minimum stroke 1.5u so frames survive 40px renders. Neutrals are ink and
 * paper; each frame uses at most ONE accent primary. The four locked frames
 * animate via slow CSS rotations (classes in globals.css, >=45s cycles) and
 * rest in a designed static pose under prefers-reduced-motion.
 *
 * Unlocks mirror theme schemes: 25/50/75/100 contributions (published lists
 * + ratings + comments). Locks gate SETTING a frame — an earned frame
 * displays for every visitor.
 */

export interface Border {
  id: string;
  name: string;
  /** One-line mood, used as tooltip copy. */
  vibe: string;
  /** 0 = free; otherwise contributions required to select. */
  unlockAt: 0 | 25 | 50 | 75 | 100;
}

export const BORDERS: Border[] = [
  { id: 'dead-wax', name: 'Dead Wax', vibe: 'Hand-scribed matrix etchings in the run-out', unlockAt: 0 },
  { id: 'picture-disc', name: 'Picture Disc', vibe: 'Bottle-cap serration, collector bait', unlockAt: 0 },
  { id: 'stamper', name: 'Stamper', vibe: 'Machine-cut castellations from the press', unlockAt: 0 },
  { id: 'half-speed-master', name: 'Half-Speed Master', vibe: 'Microgroove precision, twin rings', unlockAt: 0 },
  { id: 'crop-marks', name: 'Crop Marks', vibe: 'Print-shop registration, ready to plate', unlockAt: 0 },
  { id: 'adapter-45', name: '45 Adapter', vibe: 'The spider that saves the single', unlockAt: 0 },
  { id: 'strobe-platter', name: 'Strobe Platter', vibe: 'Pitch-perfect at the platter edge', unlockAt: 0 },
  { id: 'still-sealed', name: 'Still Sealed', vibe: 'Shrinkwrap peeled at one corner', unlockAt: 0 },
  { id: 'thirty-three', name: '33⅓', vibe: 'The long-play crawl', unlockAt: 25 },
  { id: 'lacquer', name: 'Lacquer', vibe: 'Fresh cut, light sweeping the gloss', unlockAt: 50 },
  { id: 'heat-warp', name: 'Heat Warp', vibe: 'Left in the sun, plays anyway', unlockAt: 75 },
  { id: 'locked-groove', name: 'Locked Groove', vibe: 'The runout that never lets go', unlockAt: 100 },
];

export function getBorder(id: string | null | undefined): Border | null {
  if (!id) return null;
  return BORDERS.find(b => b.id === id) ?? null;
}

/* ---- geometry helpers (0 deg = 12 o'clock, clockwise) -------------------- */

const pt = (r: number, deg: number): [number, number] => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [+(40 + r * Math.cos(a)).toFixed(2), +(40 + r * Math.sin(a)).toFixed(2)];
};

const line = (r1: number, r2: number, deg: number): string => {
  const [x1, y1] = pt(r1, deg);
  const [x2, y2] = pt(r2, deg);
  return `M${x1} ${y1}L${x2} ${y2}`;
};

const arc = (r: number, from: number, to: number): string => {
  const [x1, y1] = pt(r, from);
  const [x2, y2] = pt(r, to);
  return `M${x1} ${y1}A${r} ${r} 0 ${Math.abs(to - from) > 180 ? 1 : 0} 1 ${x2} ${y2}`;
};

/** Dead-wax etching: a short scratch near r=35, angled off the radial. */
const etch = (deg: number, offRadial: number, len: number): string => {
  const a = ((deg - 90) * Math.PI) / 180;
  const cx = 40 + 35 * Math.cos(a);
  const cy = 40 + 35 * Math.sin(a);
  const d = a + (offRadial * Math.PI) / 180;
  const dx = (Math.cos(d) * len) / 2;
  const dy = (Math.sin(d) * len) / 2;
  return `M${(cx - dx).toFixed(2)} ${(cy - dy).toFixed(2)}L${(cx + dx).toFixed(2)} ${(cy + dy).toFixed(2)}`;
};

/* Precomputed geometry (module-level, computed once). */

// Dead Wax: three uneven, hand-scribed etchings 40-55 deg off-radial.
const DEADWAX_ETCH = [etch(200, 47, 4.5), etch(216, 55, 4), etch(237, 40, 5)].join('');

// Picture Disc: 24 sawtooth teeth, roots r=33, tips r=38; the inner-circle
// subpath + evenodd subtracts the disc so only the teeth fill.
const TEETH = (() => {
  let d = '';
  for (let k = 0; k < 24; k++) {
    const [rx, ry] = pt(33, k * 15);
    const [tx, ty] = pt(38, k * 15 + 7.5);
    d += `${k ? 'L' : 'M'}${rx} ${ry}L${tx} ${ty}`;
  }
  return `${d}ZM40 7A33 33 0 1 1 40 73A33 33 0 1 1 40 7Z`;
})();

// Stamper: 16 crenellations — a square wave alternating r=37 / r=33.5 in
// 11.25 deg steps, radial jumps left as square miter corners.
const STAMPER = (() => {
  let d = '';
  for (let k = 0; k < 32; k++) {
    const r = k % 2 === 0 ? 37 : 33.5;
    const [x0, y0] = pt(r, k * 11.25);
    const [x1, y1] = pt(r, (k + 1) * 11.25);
    d += `${k === 0 ? `M${x0} ${y0}` : `L${x0} ${y0}`}A${r} ${r} 0 0 1 ${x1} ${y1}`;
  }
  return `${d}Z`;
})();

const spin = (dur: string): CSSProperties => ({ '--spin-dur': dur }) as CSSProperties;

/* ---- per-frame SVG art ---------------------------------------------------- */

function FrameArt({ id }: { id: string }) {
  const ink = 'var(--color-ink)';
  switch (id) {
    case 'dead-wax':
      return (
        <g fill="none" stroke={ink}>
          <circle cx="40" cy="40" r="35" strokeWidth="2" />
          <path d={DEADWAX_ETCH} strokeWidth="1" />
        </g>
      );
    case 'picture-disc':
      return (
        <g>
          <path d={TEETH} fill="var(--color-yellow)" fillRule="evenodd" />
          <circle cx="40" cy="40" r="33" fill="none" stroke={ink} strokeWidth="1.5" />
        </g>
      );
    case 'stamper':
      return <path d={STAMPER} fill="none" stroke={ink} strokeWidth="2" />;
    case 'half-speed-master':
      return (
        <g fill="none" stroke={ink} strokeWidth="1.5">
          <circle cx="40" cy="40" r="34" />
          <circle cx="40" cy="40" r="37.5" strokeDasharray="2 3" />
        </g>
      );
    case 'crop-marks':
      return (
        <g fill="none" stroke={ink}>
          <circle cx="40" cy="40" r="34" strokeWidth="1.5" />
          {[45, 135, 225, 315].map(c => (
            <g key={c}>
              <path d={arc(37.5, c - 11, c + 11)} strokeWidth="3" />
              <path d={line(36, 39, c - 11)} strokeWidth="1.5" />
              <path d={line(36, 39, c + 11)} strokeWidth="1.5" />
            </g>
          ))}
        </g>
      );
    case 'adapter-45':
      return (
        <g>
          <circle cx="40" cy="40" r="33" fill="none" stroke={ink} strokeWidth="2" />
          <circle cx="40" cy="40" r="37.5" fill="none" stroke={ink} strokeWidth="2" />
          {[90, 210, 330].map(deg => {
            const [cx, cy] = pt(35.25, deg);
            return (
              <rect
                key={deg}
                x="-4"
                y="-3"
                width="8"
                height="6"
                rx="2"
                fill="var(--color-cobalt)"
                transform={`translate(${cx} ${cy}) rotate(${deg})`}
              />
            );
          })}
        </g>
      );
    case 'strobe-platter':
      return (
        <g fill="none" strokeWidth="1.5">
          {Array.from({ length: 48 }, (_, k) => {
            const major = k % 12 === 0;
            return (
              <path
                key={k}
                d={major ? line(32.75, 38.25, k * 7.5) : line(34, 37, k * 7.5)}
                stroke={major ? 'var(--color-cobalt)' : ink}
              />
            );
          })}
        </g>
      );
    case 'still-sealed':
      return (
        <g fill="none">
          {/* 346 deg green wrap; the 14 deg paper gap is centered at 40 deg. */}
          <path d={arc(35.5, 47, 393)} stroke="var(--color-green)" strokeWidth="4" />
          <path d={line(34.25, 36.75, 47)} stroke={ink} strokeWidth="2.5" />
          <path d={line(34.25, 36.75, 33)} stroke={ink} strokeWidth="2.5" />
        </g>
      );
    case 'thirty-three':
      return (
        <g fill="none">
          <circle cx="40" cy="40" r="33" stroke={ink} strokeWidth="1.5" />
          {/* Rest pose: rotated -90 + half-dash offset centers a dash at 12
              o'clock; the 90s spin starts from that pose. */}
          <g className="frame-spin" style={spin('90s')}>
            <g transform="rotate(-90 40 40)">
              <circle
                cx="40"
                cy="40"
                r="36.5"
                stroke="var(--color-cobalt)"
                strokeWidth="2.5"
                strokeDasharray="6 4"
                strokeDashoffset="3"
              />
            </g>
          </g>
        </g>
      );
    case 'lacquer': {
      const [sx1, sy1] = pt(35.4, 285);
      const [sx2, sy2] = pt(35.4, 315);
      return (
        <g fill="none">
          <circle cx="40" cy="40" r="35.4" stroke="var(--color-yellow)" strokeWidth="4.8" />
          <circle cx="40" cy="40" r="33" stroke={ink} strokeWidth="1.5" />
          <circle cx="40" cy="40" r="37.75" stroke={ink} strokeWidth="1.5" />
          <defs>
            {/* Feathered paper sheen — no hard stops; peaks at 25% opacity. */}
            <linearGradient id="ordko-lacquer-sheen" gradientUnits="userSpaceOnUse" x1={sx1} y1={sy1} x2={sx2} y2={sy2}>
              <stop offset="0" stopColor="var(--color-paper)" stopOpacity="0" />
              <stop offset="0.5" stopColor="var(--color-paper)" stopOpacity="0.25" />
              <stop offset="1" stopColor="var(--color-paper)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Rest pose: sheen parked at 10 o'clock (300 deg); drifts 1 rev/45s. */}
          <g className="frame-spin" style={spin('45s')}>
            <path d={arc(35.4, 285, 315)} stroke="url(#ordko-lacquer-sheen)" strokeWidth="4.8" />
          </g>
        </g>
      );
    }
    case 'heat-warp': {
      const [wx1, wy1] = pt(35.5, 0);
      const [wx2, wy2] = pt(35.5, 120);
      return (
        <g fill="none">
          <circle cx="40" cy="40" r="33.5" stroke={ink} strokeWidth="1.5" />
          <circle cx="40" cy="40" r="37.5" stroke={ink} strokeWidth="1.5" />
          {/* Ink base band the red lobes melt over. */}
          <circle cx="40" cy="40" r="35.5" stroke={ink} strokeWidth="4" opacity="0.22" />
          <defs>
            {/* SVG has no conic gradient: two opposed 120-deg feathered lobes
                approximate the red-to-ink conic wash with no hard stops. */}
            <linearGradient id="ordko-warp-lobe" gradientUnits="userSpaceOnUse" x1={wx1} y1={wy1} x2={wx2} y2={wy2}>
              <stop offset="0" stopColor="var(--color-red)" stopOpacity="0" />
              <stop offset="0.5" stopColor="var(--color-red)" stopOpacity="0.55" />
              <stop offset="1" stopColor="var(--color-red)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Rest pose: lobes centered at 2 and 8 o'clock; 1 rev/120s. */}
          <g className="frame-spin" style={spin('120s')}>
            <path d={arc(35.5, 0, 120)} stroke="url(#ordko-warp-lobe)" strokeWidth="4" />
            <path d={arc(35.5, 0, 120)} stroke="url(#ordko-warp-lobe)" strokeWidth="4" transform="rotate(180 40 40)" />
          </g>
        </g>
      );
    }
    case 'locked-groove':
      return (
        <g fill="none" stroke={ink}>
          <g className="frame-spin" style={spin('150s')}>
            <circle cx="40" cy="40" r="37.5" strokeWidth="2" strokeDasharray="3 5" />
          </g>
          <g className="frame-spin frame-spin-ccw" style={spin('100s')}>
            <circle cx="40" cy="40" r="33.5" strokeWidth="1.5" strokeDasharray="2 4" />
          </g>
        </g>
      );
    default:
      return null;
  }
}

/**
 * Frame wrapper around avatar content. Always renders a size x size box:
 * with no (or unknown) border the children fill it edge to edge — exactly
 * today's plain avatar; with a frame the children shrink to the r=32/80
 * circle (80% box) and the frame annulus draws around them.
 * Children should size themselves h-full/w-full.
 */
export function AvatarFrame({
  borderId,
  size,
  children,
}: {
  borderId: string | null;
  size: number;
  children: ReactNode;
}) {
  const border = getBorder(borderId);
  if (!border) {
    return (
      <span className="block flex-none" style={{ width: size, height: size }}>
        {children}
      </span>
    );
  }
  return (
    <span className="relative block flex-none" style={{ width: size, height: size }}>
      <span
        className="absolute overflow-hidden rounded-full"
        style={{ left: '10%', top: '10%', width: '80%', height: '80%' }}
      >
        {children}
      </span>
      <svg
        viewBox="0 0 80 80"
        width={size}
        height={size}
        aria-hidden
        className="pointer-events-none absolute inset-0"
      >
        <FrameArt id={border.id} />
      </svg>
    </span>
  );
}
