/** Designed monogram placeholder cover (LP-label look) — the only acceptable miss state. */

const LABEL_COLORS = ['#54473A', '#5A3128', '#37424A', '#4C4A3A', '#7A5B22', '#413E3B', '#2F4438', '#6B3B23'];

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function placeholderCover(title: string, artist: string): string {
  const bg = LABEL_COLORS[hashCode(`${title}|${artist}`) % LABEL_COLORS.length];
  const words = String(title || '?').trim().split(/\s+/).filter(Boolean);
  const mono = (words.slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?').replace(/[<>&"']/g, '');
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 250 250'>` +
    `<rect width='250' height='250' fill='${bg}'/>` +
    `<circle cx='125' cy='125' r='94' fill='none' stroke='rgba(237,232,223,0.25)' stroke-width='1.5'/>` +
    `<circle cx='125' cy='125' r='4.5' fill='rgba(237,232,223,0.55)'/>` +
    `<text x='125' y='108' text-anchor='middle' font-family='Arial Black,Arial,sans-serif' font-weight='900' font-size='52' fill='#EDE8DF'>${mono}</text>` +
    `<text x='125' y='178' text-anchor='middle' font-family='Consolas,monospace' font-size='13' letter-spacing='2' fill='rgba(237,232,223,0.55)'>RUNOUT</text>` +
    `</svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
