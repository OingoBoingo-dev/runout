/**
 * Designed monogram placeholder cover — the only acceptable miss state.
 * Two-letter monogram on a deterministic tint from the Pressing-Plant quartet;
 * text follows the contrast rules (ink on yellow, paper on cobalt/red/green).
 */

const QUARTET = [
  { bg: '#FFC72C', fg: '#16150F' }, // yellow -> ink
  { bg: '#2C4BDF', fg: '#FAF6EC' }, // cobalt -> paper
  { bg: '#E8442E', fg: '#FAF6EC' }, // red -> paper
  { bg: '#1CA24D', fg: '#FAF6EC' }, // green -> paper
];

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Deterministic quartet pick — also used for genre-pill tinting. */
export function quartetTint(key: string): { bg: string; fg: string } {
  return QUARTET[hashCode(key) % QUARTET.length];
}

export function placeholderCover(title: string, artist: string): string {
  const { bg, fg } = quartetTint(`${title}|${artist}`);
  const words = String(title || '?').trim().split(/\s+/).filter(Boolean);
  const mono = (words.slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?').replace(/[<>&"']/g, '');
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 250 250'>` +
    `<rect width='250' height='250' fill='${bg}'/>` +
    `<circle cx='125' cy='125' r='94' fill='none' stroke='${fg}' stroke-opacity='0.3' stroke-width='1.5'/>` +
    `<circle cx='125' cy='125' r='4.5' fill='${fg}' fill-opacity='0.55'/>` +
    `<text x='125' y='108' text-anchor='middle' font-family='Arial Black,Arial,sans-serif' font-weight='900' font-size='52' fill='${fg}'>${mono}</text>` +
    `<text x='125' y='178' text-anchor='middle' font-family='Consolas,monospace' font-size='13' letter-spacing='2' fill='${fg}' fill-opacity='0.6'>ORDKO</text>` +
    `</svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
