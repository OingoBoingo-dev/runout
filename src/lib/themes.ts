/**
 * Curated color palettes (cycle 11 overhaul) — Office-style variety with the
 * Pressing-Plant rule intact: color MEANS something. Each palette assigns one
 * hue to each of four FUNCTIONAL ROLES — rank (was yellow), interactive (was
 * cobalt), emotion/likes/publish (was red), confirm (was green) — plus the
 * five neutrals (paper ground, card surface, ink, secondary, hairline).
 * globals.css aliases the legacy primary tokens (`--color-yellow` etc.) to
 * the role vars permanently, so every bg-cobalt/text-red/... utility in the
 * app follows the active palette with zero component churn. Within a palette
 * the semantics hold — rank is always ONE hue, interactive another.
 *
 * Contrast is a hard gate, verified for all 12: ink/paper >= 7:1 (AAA body),
 * secondary/paper >= 4.5:1 (AA), and every role hue passes by how it actually
 * renders — interactive + emotion are TEXT roles (links, like-counts):
 * >= 3:1 against both paper and card; rank + confirm are predominantly FILLS
 * (bg-yellow chips/CTAs always carry text-ink; the bg-green toggle carries
 * text-paper), so they pass by EITHER that text gate OR the fill pairing at
 * >= 4.5:1 (ink-on-rank / paper-on-confirm). Confirm additionally holds the
 * text gate everywhere because text-green exists (SettingsForm).
 *
 * The four locked palettes are ambient: a slow full-page wash of the role
 * hues drifts behind content (see `html.ambient body::before` in
 * globals.css). They unlock at 25/50/75/100 contributions (published lists +
 * ratings + comments) — locks gate SETTING a palette, never seeing one
 * adopted on a visited profile.
 */

export interface Palette {
  id: string;
  name: string;
  /** One-line mood, shown as the tile tooltip. */
  vibe: string;
  /** One hue per functional role — the semantic layer every element follows. */
  roles: {
    rank: string;
    interactive: string;
    emotion: string;
    confirm: string;
  };
  neutrals: {
    paper: string;
    card: string;
    ink: string;
    secondary: string;
    hairline: string;
  };
  /** Slow drifting role-hue atmosphere behind the whole page. */
  ambient?: true;
  /** Contributions required to select; 0 = free. */
  unlockAt: 0 | 25 | 50 | 75 | 100;
}

/** Hairline is always the palette's ink at 8% alpha, matching stock. */
const hairline = (ink: string) => `color-mix(in srgb, ${ink} 8%, transparent)`;

export const SCHEMES: Palette[] = [
  {
    id: 'stock',
    name: 'Stock Paper',
    vibe: 'The pressing-plant default — warm paper, flat ink',
    // The brand four, byte-identical to the pre-overhaul globals.css defaults.
    roles: { rank: '#FFC72C', interactive: '#2C4BDF', emotion: '#E8442E', confirm: '#1CA24D' },
    neutrals: { paper: '#FAF6EC', card: '#FFFFFF', ink: '#16150F', secondary: '#6F6A5E', hairline: hairline('#16150F') },
    unlockAt: 0,
  },
  {
    id: 'test-pressing',
    name: 'Test Pressing',
    vibe: 'White label, gallery grey — sharp signal primaries',
    roles: { rank: '#FFB000', interactive: '#0F4CD8', emotion: '#D31F30', confirm: '#0E7444' },
    neutrals: { paper: '#F2F2EF', card: '#FDFDFC', ink: '#131414', secondary: '#585D5A', hairline: hairline('#131414') },
    unlockAt: 0,
  },
  {
    id: 'cobalt-rust',
    name: 'Cobalt & Rust',
    vibe: 'Deep blues against rust and carmine on bone paper',
    roles: { rank: '#D65A1F', interactive: '#1D4FD7', emotion: '#BE123C', confirm: '#0F6674' },
    neutrals: { paper: '#F3F0E9', card: '#FFFFFF', ink: '#191410', secondary: '#6D6459', hairline: hairline('#191410') },
    unlockAt: 0,
  },
  {
    id: 'marigold',
    name: 'Marigold',
    vibe: 'Sunny cream, lapis blue and gold — a summer 45',
    roles: { rank: '#E8A800', interactive: '#1354C8', emotion: '#BC3F12', confirm: '#4D7C0F' },
    neutrals: { paper: '#F8F1DD', card: '#FFFDF6', ink: '#191305', secondary: '#6E6142', hairline: hairline('#191305') },
    unlockAt: 0,
  },
  {
    id: 'crate-digger',
    name: 'Crate Digger',
    vibe: 'Kraft sepia, brass, moss and brick — attic finds',
    roles: { rank: '#C08A00', interactive: '#0C6B5D', emotion: '#AC3A1C', confirm: '#55741F' },
    neutrals: { paper: '#F0E6D0', card: '#FAF3E3', ink: '#201505', secondary: '#705C3B', hairline: hairline('#201505') },
    unlockAt: 0,
  },
  {
    id: 'rose-cut',
    name: 'Rose Cut',
    vibe: 'Rose paper, berry and plum — a lacquer cut for someone',
    roles: { rank: '#C77B21', interactive: '#6D28D9', emotion: '#C01048', confirm: '#116149' },
    neutrals: { paper: '#F9ECEA', card: '#FEF7F6', ink: '#24100F', secondary: '#7E5450', hairline: hairline('#24100F') },
    unlockAt: 0,
  },
  {
    id: 'amethyst',
    name: 'Amethyst Press',
    vibe: 'Black, smoke and purple — deluxe box-set energy',
    roles: { rank: '#E2B93B', interactive: '#A78BFA', emotion: '#F06FAE', confirm: '#43D08A' },
    neutrals: { paper: '#131118', card: '#1D1A24', ink: '#EFECF6', secondary: '#A29CB2', hairline: hairline('#EFECF6') },
    unlockAt: 0,
  },
  {
    id: 'after-hours',
    name: 'After Hours',
    vibe: 'Charcoal dark — listening past midnight',
    roles: { rank: '#E5A93D', interactive: '#7B96FF', emotion: '#FF6B5C', confirm: '#52C57E' },
    neutrals: { paper: '#17171A', card: '#212126', ink: '#F2F0E9', secondary: '#A6A29A', hairline: hairline('#F2F0E9') },
    unlockAt: 0,
  },
  {
    id: 'blacklight',
    name: 'Blacklight',
    vibe: 'UV poster glow on a dark wall',
    roles: { rank: '#EFC431', interactive: '#8F8CFB', emotion: '#F468BC', confirm: '#53E08C' },
    neutrals: { paper: '#131020', card: '#1D1833', ink: '#ECE7FB', secondary: '#A79BCE', hairline: hairline('#ECE7FB') },
    ambient: true,
    unlockAt: 25,
  },
  {
    id: 'lava-lounge',
    name: 'Lava Lounge',
    vibe: 'Ember amber drifting like slow wax',
    roles: { rank: '#FFAE3D', interactive: '#6CB2F0', emotion: '#FF6247', confirm: '#8FCE7C' },
    neutrals: { paper: '#1A0E0C', card: '#281613', ink: '#F7E9DE', secondary: '#C49B80', hairline: hairline('#F7E9DE') },
    ambient: true,
    unlockAt: 50,
  },
  {
    id: 'deep-groove',
    name: 'Deep Groove',
    vibe: 'Abyssal teal, dub-plate pressure',
    roles: { rank: '#D8B54A', interactive: '#41BDF0', emotion: '#FF7E96', confirm: '#3BD69B' },
    neutrals: { paper: '#0C1616', card: '#152322', ink: '#E3F0EB', secondary: '#8FB0A6', hairline: hairline('#E3F0EB') },
    ambient: true,
    unlockAt: 75,
  },
  {
    id: 'gold-master',
    name: 'Gold Master',
    vibe: 'Black and gold — the final lacquer',
    roles: { rank: '#F2C24E', interactive: '#82ABE3', emotion: '#E0704F', confirm: '#97C069' },
    neutrals: { paper: '#141109', card: '#211C10', ink: '#F4EDD9', secondary: '#BFA96F', hairline: hairline('#F4EDD9') },
    ambient: true,
    unlockAt: 100,
  },
];

/**
 * Retired cycle-1 scheme ids -> their closest cycle-11 palette. Live users
 * have these stored (localStorage['ordko-scheme'], profiles.theme_scheme), so
 * every read path resolves through getScheme, which consults this map — a
 * stored legacy id never dead-ends.
 */
export const LEGACY_MAP: Record<string, string> = {
  'anti-static': 'test-pressing',
  'tobacco-sleeve': 'crate-digger',
  'blush-press': 'rose-cut',
  'mint-condition': 'crate-digger',
  'cold-storage': 'cobalt-rust',
  'wood-panel': 'after-hours',
};

export function getScheme(id: string | null | undefined): Palette | null {
  if (!id) return null;
  const resolved = LEGACY_MAP[id] ?? id;
  return SCHEMES.find(s => s.id === resolved) ?? null;
}

/**
 * The 9 custom-property slots a palette owns: the 5 neutrals plus the 4 role
 * hues. globals.css declares the stock values and aliases the legacy primary
 * tokens (--color-yellow/cobalt/red/green) to the role vars.
 */
export const THEME_VARS = [
  '--color-paper',
  '--color-card',
  '--color-ink',
  '--color-secondary',
  '--color-hairline',
  '--role-rank',
  '--role-interactive',
  '--role-emotion',
  '--role-confirm',
] as const;

export function schemeVars(p: Palette): Record<(typeof THEME_VARS)[number], string> {
  return {
    '--color-paper': p.neutrals.paper,
    '--color-card': p.neutrals.card,
    '--color-ink': p.neutrals.ink,
    '--color-secondary': p.neutrals.secondary,
    '--color-hairline': p.neutrals.hairline,
    '--role-rank': p.roles.rank,
    '--role-interactive': p.roles.interactive,
    '--role-emotion': p.roles.emotion,
    '--role-confirm': p.roles.confirm,
  };
}

/**
 * Apply (or clear, with null) a palette on the document root. Client-only;
 * no-ops during SSR. Null removes all 9 vars so everything falls back to the
 * stock declarations in globals.css. Ambient palettes additionally toggle the
 * `ambient` class that drives the fixed role-hue wash in globals.css.
 */
export function applyScheme(p: Palette | null): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (!p) {
    THEME_VARS.forEach(k => root.style.removeProperty(k));
    root.classList.remove('ambient');
    return;
  }
  const vars = schemeVars(p);
  THEME_VARS.forEach(k => root.style.setProperty(k, vars[k]));
  root.classList.toggle('ambient', p.ambient === true);
}
