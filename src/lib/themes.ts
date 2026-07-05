/**
 * Curated theme schemes — Pressing-Plant rules apply: every scheme re-tints
 * the NEUTRAL system only (paper ground, card surface, ink, secondary, and
 * the derived hairline). The four primaries (yellow = rank, cobalt =
 * interactive, red = emotion, green = confirmation) never change.
 *
 * Ink-on-paper contrast is >= 7:1 (WCAG AAA body text) and secondary-on-paper
 * >= 4.5:1 (AA) for every scheme, verified for both light and dark papers.
 *
 * Schemes 9-12 are ambient: a slow full-page gradient wash behind content
 * (see `html.ambient body::before` in globals.css). They unlock at 25/50/75/
 * 100 contributions (published lists + ratings + comments) — locks gate
 * SETTING a scheme, never seeing one adopted on a visited profile.
 */

export interface Scheme {
  id: string;
  name: string;
  /** One-line mood, shown as the tile tooltip. */
  vibe: string;
  colors: {
    paper: string;
    card: string;
    ink: string;
    secondary: string;
  };
  /** Slow drifting gradient atmosphere behind the whole page. */
  ambient?: true;
  /** Contributions required to select; undefined = free. */
  unlockAt?: 25 | 50 | 75 | 100;
}

export const SCHEMES: Scheme[] = [
  {
    id: 'stock',
    name: 'Stock Paper',
    vibe: 'The pressing-plant default — warm paper, flat ink',
    colors: { paper: '#FAF6EC', card: '#FFFFFF', ink: '#16150F', secondary: '#6F6A5E' },
  },
  {
    id: 'anti-static',
    name: 'Anti-Static',
    vibe: 'Cool gallery grey, inner-sleeve clean',
    colors: { paper: '#F1F2F3', card: '#FBFCFC', ink: '#131619', secondary: '#5C6570' },
  },
  {
    id: 'tobacco-sleeve',
    name: 'Tobacco Sleeve',
    vibe: 'Sun-aged sepia, attic crate find',
    colors: { paper: '#F2E7D3', card: '#FAF2E4', ink: '#26190B', secondary: '#77644A' },
  },
  {
    id: 'blush-press',
    name: 'Blush Press',
    vibe: 'Soft pink, limited pressing of 300',
    colors: { paper: '#F7E9E6', card: '#FCF4F1', ink: '#2A1512', secondary: '#835850' },
  },
  {
    id: 'mint-condition',
    name: 'Mint Condition',
    vibe: 'Sage and moss, never played',
    colors: { paper: '#EAF0E2', card: '#F5F8EF', ink: '#14190F', secondary: '#59684D' },
  },
  {
    id: 'cold-storage',
    name: 'Cold Storage',
    vibe: 'Blue-slate archive, climate controlled',
    colors: { paper: '#E9EEF3', card: '#F5F8FA', ink: '#10161C', secondary: '#526070' },
  },
  {
    id: 'after-hours',
    name: 'After Hours',
    vibe: 'Charcoal dark — listening past midnight',
    colors: { paper: '#17171A', card: '#212126', ink: '#F2F0E9', secondary: '#A6A29A' },
  },
  {
    id: 'wood-panel',
    name: 'Wood Panel',
    vibe: 'Deep brown hi-fi den, lamps low',
    colors: { paper: '#1C130E', card: '#291D15', ink: '#F1E7D8', secondary: '#B49F87' },
  },
  {
    id: 'blacklight',
    name: 'Blacklight',
    vibe: 'UV violet glow on a dark wall',
    colors: { paper: '#131020', card: '#1D1833', ink: '#ECE7FB', secondary: '#A79BCE' },
    ambient: true,
    unlockAt: 25,
  },
  {
    id: 'lava-lounge',
    name: 'Lava Lounge',
    vibe: 'Ember reds drifting like slow wax',
    colors: { paper: '#1A0E0C', card: '#281613', ink: '#F7E9DE', secondary: '#C49B80' },
    ambient: true,
    unlockAt: 50,
  },
  {
    id: 'deep-groove',
    name: 'Deep Groove',
    vibe: 'Abyssal teal, dub-plate pressure',
    colors: { paper: '#0C1616', card: '#152322', ink: '#E3F0EB', secondary: '#8FB0A6' },
    ambient: true,
    unlockAt: 75,
  },
  {
    id: 'gold-master',
    name: 'Gold Master',
    vibe: 'Black and gold — the final lacquer',
    colors: { paper: '#141109', card: '#211C10', ink: '#F4EDD9', secondary: '#BFA96F' },
    ambient: true,
    unlockAt: 100,
  },
];

export function getScheme(id: string | null | undefined): Scheme | null {
  if (!id) return null;
  return SCHEMES.find(s => s.id === id) ?? null;
}

/** The 5 custom-property slots a scheme owns — identical to the old tint set. */
export const THEME_VARS = [
  '--color-paper',
  '--color-card',
  '--color-ink',
  '--color-secondary',
  '--color-hairline',
] as const;

export function schemeVars(s: Scheme): Record<(typeof THEME_VARS)[number], string> {
  return {
    '--color-paper': s.colors.paper,
    '--color-card': s.colors.card,
    '--color-ink': s.colors.ink,
    '--color-secondary': s.colors.secondary,
    // Hairline is always the scheme's ink at 8% alpha, matching stock.
    '--color-hairline': `color-mix(in srgb, ${s.colors.ink} 8%, transparent)`,
  };
}

/**
 * Apply (or clear, with null) a scheme on the document root. Client-only;
 * no-ops during SSR. Ambient schemes additionally toggle the `ambient` class
 * that drives the fixed gradient-wash layer in globals.css.
 */
export function applyScheme(s: Scheme | null): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (!s) {
    THEME_VARS.forEach(k => root.style.removeProperty(k));
    root.classList.remove('ambient');
    return;
  }
  const vars = schemeVars(s);
  THEME_VARS.forEach(k => root.style.setProperty(k, vars[k]));
  root.classList.toggle('ambient', s.ambient === true);
}
