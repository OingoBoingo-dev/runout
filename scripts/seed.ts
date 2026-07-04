/**
 * Runout seed — populates a fresh instance so Explore, feeds and the Chart are
 * alive on first deploy. Service-role only; run AFTER applying migrations:
 *
 *   npm run seed          (reads .env.local)
 *
 * Creates 3 demo users, pulls ~30 real releases through MusicBrainz (1 req /
 * 1100ms with a proper User-Agent), publishes 5 lists with blurbs, and adds
 * cross-follows, ratings, comments and likes. Idempotent-ish: safe to re-run;
 * existing rows are upserted or skipped.
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MB_CONTACT = process.env.MB_CONTACT ?? 'contact-not-configured@example.com';
if (!url || !serviceKey) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example).');
  process.exit(1);
}
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

const UA = `Runout/0.1 ( ${MB_CONTACT} )`;
let lastMB = 0;
async function mb<T>(path: string): Promise<T> {
  const wait = Math.max(0, lastMB + 1100 - Date.now());
  if (wait) await new Promise(r => setTimeout(r, wait));
  lastMB = Date.now();
  const res = await fetch(`https://musicbrainz.org/ws/2${path}`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`MusicBrainz ${res.status} for ${path}`);
  return (await res.json()) as T;
}

/* Demo users — distinct taste profiles. */
const USERS = [
  {
    email: 'nadia@demo.runout.local',
    password: 'runout-demo-1',
    username: 'nadia',
    display_name: 'Nadia Reyes',
    bio: "Warehouse ambience and 120bpm minimalism. If it hisses, I'm in.",
  },
  {
    email: 'marcus@demo.runout.local',
    password: 'runout-demo-2',
    username: 'marcus',
    display_name: 'Marcus Webb',
    bio: '4AD lifer. I own three copies of Treasure and regret nothing.',
  },
  {
    email: 'kei@demo.runout.local',
    password: 'runout-demo-3',
    username: 'kei',
    display_name: 'Kei Tanaka',
    bio: 'City pop, MPB and spiritual jazz — music for driving nowhere slowly.',
  },
] as const;

/* ~30 real releases, resolved live against MusicBrainz release-group search. */
const RELEASES: { artist: string; title: string }[] = [
  { artist: 'Porter Ricks', title: 'Biokinetics' },
  { artist: 'Basic Channel', title: 'BCD' },
  { artist: 'Monolake', title: 'Hongkong' },
  { artist: 'Gas', title: 'Pop' },
  { artist: 'Ricardo Villalobos', title: 'Alcachofa' },
  { artist: 'Plastikman', title: 'Consumed' },
  { artist: 'Aphex Twin', title: 'Selected Ambient Works 85-92' },
  { artist: 'Boards of Canada', title: 'Music Has the Right to Children' },
  { artist: 'Burial', title: 'Untrue' },
  { artist: 'Brian Eno', title: 'Ambient 1: Music for Airports' },
  { artist: 'Hiroshi Yoshimura', title: 'Music for Nine Post Cards' },
  { artist: 'Midori Takada', title: 'Through the Looking Glass' },
  { artist: 'Cocteau Twins', title: 'Treasure' },
  { artist: 'My Bloody Valentine', title: 'Loveless' },
  { artist: 'Slowdive', title: 'Souvlaki' },
  { artist: 'Joy Division', title: 'Unknown Pleasures' },
  { artist: 'The Cure', title: 'Disintegration' },
  { artist: 'Bauhaus', title: 'In the Flat Field' },
  { artist: 'Pixies', title: 'Doolittle' },
  { artist: 'Wire', title: 'Chairs Missing' },
  { artist: 'Tatsuro Yamashita', title: 'For You' },
  { artist: 'Mariya Takeuchi', title: 'Variety' },
  { artist: 'Taeko Onuki', title: 'Sunshower' },
  { artist: 'Casiopea', title: 'Mint Jams' },
  { artist: 'Milton Nascimento', title: 'Clube da Esquina' },
  { artist: 'Caetano Veloso', title: 'Transa' },
  { artist: 'Jorge Ben', title: 'A Tábua de Esmeralda' },
  { artist: 'Arthur Verocai', title: 'Arthur Verocai' },
  { artist: 'Alice Coltrane', title: 'Journey in Satchidananda' },
  { artist: 'Pharoah Sanders', title: 'Karma' },
  { artist: 'John Coltrane', title: 'A Love Supreme' },
];

interface MBRG {
  id: string;
  title?: string;
  'first-release-date'?: string;
  'primary-type'?: string;
  'artist-credit'?: { name?: string; joinphrase?: string; artist?: { id?: string; name?: string } }[];
  tags?: { name: string; count?: number }[];
}

function norm(rg: MBRG) {
  const artist =
    (rg['artist-credit'] ?? []).map(c => (c.name ?? c.artist?.name ?? '') + (c.joinphrase ?? '')).join('') ||
    'Unknown artist';
  const y = Number((rg['first-release-date'] ?? '').slice(0, 4));
  return {
    mbid: rg.id,
    kind: 'album' as const,
    title: rg.title ?? 'Untitled',
    artist_name: artist,
    artist_mbid: rg['artist-credit']?.[0]?.artist?.id ?? null,
    year: Number.isInteger(y) && y > 0 ? y : null,
    primary_type: rg['primary-type'] ?? null,
    cover_url: `https://coverartarchive.org/release-group/${rg.id}/front-500`,
    wikipedia_url: null,
    discogs_url: null,
    tags: (rg.tags ?? [])
      .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
      .slice(0, 5)
      .map(t => t.name.toLowerCase()),
    fetched_at: new Date().toISOString(),
  };
}

async function main() {
  console.log('— demo users');
  const userIds: Record<string, string> = {};
  for (const u of USERS) {
    const { data: created, error } = await db.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { username: u.username, display_name: u.display_name },
    });
    if (error) {
      // Probably already exists — look the profile up by username.
      const { data: prof } = await db.from('profiles').select('id').eq('username', u.username).maybeSingle();
      if (!prof) throw new Error(`Cannot create or find user ${u.username}: ${error.message}`);
      userIds[u.username] = prof.id;
    } else {
      userIds[u.username] = created.user.id;
    }
    await db.from('profiles').update({ bio: u.bio, display_name: u.display_name }).eq('id', userIds[u.username]);
    console.log(`  @${u.username} -> ${userIds[u.username]}`);
  }

  console.log('— catalog via MusicBrainz (throttled ~1.1s/request, ~40s total)');
  // Anti-hallucination guard: only accept a candidate whose normalized title is
  // EXACTLY the requested title (dashes/diacritics/spacing folded) and whose
  // artist credit shares a name token. A wrong record is worse than a miss.
  const fold = (s: string) =>
    s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');
  const tokens = (s: string) =>
    s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);
  const byTitle: Record<string, ReturnType<typeof norm>> = {};

  const pickExact = (cands: MBRG[], title: string, artist: string | null): MBRG | undefined => {
    const want = fold(title);
    const wantTokens = artist ? new Set(tokens(artist)) : null;
    const exact = cands.filter(rg => {
      if (fold(rg.title ?? '') !== want) return false;
      if (!wantTokens) return true; // arid-constrained query — artist already guaranteed
      const credit = (rg['artist-credit'] ?? []).map(c => c.name ?? c.artist?.name ?? '').join(' ');
      const creditTokens = tokens(credit);
      // Non-Latin credits (e.g. 山下達郎) yield no Latin tokens to compare.
      return creditTokens.length === 0 || creditTokens.some(t => wantTokens.has(t));
    });
    // Prefer proper albums, then the earliest first release.
    exact.sort((a, b) => {
      const albumA = a['primary-type'] === 'Album' ? 0 : 1;
      const albumB = b['primary-type'] === 'Album' ? 0 : 1;
      if (albumA !== albumB) return albumA - albumB;
      return (a['first-release-date'] ?? '9999').localeCompare(b['first-release-date'] ?? '9999');
    });
    return exact[0];
  };

  for (const r of RELEASES) {
    // Pass 1: fielded search on title + artist name.
    const q1 = encodeURIComponent(`releasegroup:"${r.title}" AND artist:(${r.artist})`);
    const res1 = await mb<{ 'release-groups'?: MBRG[] }>(`/release-group?query=${q1}&fmt=json&limit=8`);
    let rg = pickExact(res1['release-groups'] ?? [], r.title, r.artist);

    // Pass 2 (fallback): the artist index misses non-Latin canonical names whose
    // credits are Latin (山下達郎 credited as "Tatsuro Yamashita"), so resolve the
    // artist MBID via the alias-aware artist search, then constrain by arid.
    if (!rg) {
      const aq = encodeURIComponent(`"${r.artist}"`);
      const ares = await mb<{ artists?: { id: string; score?: number }[] }>(
        `/artist?query=${aq}&fmt=json&limit=1`,
      );
      const arid = ares.artists?.[0]?.id;
      if (arid) {
        const q2 = encodeURIComponent(`releasegroup:"${r.title}" AND arid:${arid}`);
        const res2 = await mb<{ 'release-groups'?: MBRG[] }>(
          `/release-group?query=${q2}&fmt=json&limit=8`,
        );
        rg = pickExact(res2['release-groups'] ?? [], r.title, null);
      }
    }

    if (!rg) {
      console.warn(`  MISS (no exact-title match): ${r.artist} — ${r.title}`);
      continue;
    }
    const item = norm(rg);
    byTitle[r.title] = item;
    console.log(`  ${item.artist_name} — ${item.title} (${item.year ?? '—'})`);
  }
  const items = Object.values(byTitle);
  const { error: upErr } = await db.from('catalog_items').upsert(items, { onConflict: 'mbid' });
  if (upErr) throw new Error(`catalog upsert: ${upErr.message}`);

  const mbidOf = (title: string) => byTitle[title]?.mbid;

  console.log('— lists');
  const LISTS: {
    owner: string;
    title: string;
    description: string;
    entries: { title: string; blurb?: string }[];
  }[] = [
    {
      owner: 'nadia',
      title: 'Concrete & Fog',
      description: 'Records for empty warehouses at 6am — dub techno, tape hiss, and the long fade.',
      entries: [
        { title: 'Biokinetics', blurb: "Chain Reaction's cornerstone. Every dub techno record since is a footnote to this." },
        { title: 'Pop', blurb: "Voigt's forest at night. Kick drum like a heartbeat under wet leaves." },
        { title: 'Selected Ambient Works 85-92', blurb: 'Still sounds like it was beamed in from somewhere kinder.' },
        { title: 'BCD', blurb: 'Concrete turning to vapor, side after side.' },
        { title: 'Hongkong', blurb: 'Monolake build a city out of static and let it rain.' },
        { title: 'Music for Nine Post Cards', blurb: 'Kankyō ongaku at its gentlest.' },
        { title: 'Through the Looking Glass' },
        { title: 'Consumed' },
        { title: 'Alcachofa' },
        { title: 'Ambient 1: Music for Airports' },
        { title: 'Untrue' },
        { title: 'Music Has the Right to Children' },
      ],
    },
    {
      owner: 'nadia',
      title: 'Minimal, Maximal',
      description: 'Less is a door.',
      entries: [
        { title: 'Alcachofa' },
        { title: 'Consumed' },
        { title: 'Hongkong' },
        { title: 'BCD' },
      ],
    },
    {
      owner: 'marcus',
      title: 'Cathedrals of Noise',
      description: 'Where reverb goes to worship — 4AD and adjacent.',
      entries: [
        { title: 'Loveless', blurb: 'The loudest tenderness ever pressed to vinyl.' },
        { title: 'Treasure', blurb: 'Liz Fraser sings in a language you almost remember.' },
        { title: 'Souvlaki', blurb: 'Souvlaki Space Station forever.' },
        { title: 'Unknown Pleasures', blurb: 'The gray standard.' },
        { title: 'Disintegration' },
        { title: 'In the Flat Field' },
        { title: 'Doolittle' },
        { title: 'Chairs Missing' },
      ],
    },
    {
      owner: 'kei',
      title: 'Tokyo Night Drive',
      description: 'Expressway lights, FM radio, 1982 forever.',
      entries: [
        { title: 'For You', blurb: 'The high-water mark of city pop production. Every snare is a sunrise.' },
        { title: 'Variety' },
        { title: 'Sunshower', blurb: 'Sunshower predicted the next forty years of Japanese pop.' },
        { title: 'Mint Jams' },
        { title: 'Music for Nine Post Cards' },
      ],
    },
    {
      owner: 'kei',
      title: 'Equatorial',
      description: 'Minas Gerais to Bahia — the Brazilian records that rewired my ears.',
      entries: [
        { title: 'Clube da Esquina', blurb: 'Maybe the most generous record ever made.' },
        { title: 'Transa' },
        { title: 'A Tábua de Esmeralda' },
        { title: 'Arthur Verocai' },
        { title: 'Journey in Satchidananda' },
        { title: 'Karma' },
        { title: 'A Love Supreme' },
      ],
    },
  ];

  const listIds: Record<string, string> = {};
  for (const l of LISTS) {
    const owner = userIds[l.owner];
    const { data: existing } = await db
      .from('lists')
      .select('id')
      .eq('owner', owner)
      .eq('title', l.title)
      .maybeSingle();
    let id = existing?.id as string | undefined;
    if (!id) {
      const { data, error } = await db
        .from('lists')
        .insert({ owner, title: l.title, description: l.description, kind: 'album', status: 'published' })
        .select('id')
        .single();
      if (error || !data) throw new Error(`list ${l.title}: ${error?.message}`);
      id = data.id;
    }
    listIds[l.title] = id!;
    await db.from('list_entries').delete().eq('list_id', id!);
    const rows = l.entries
      .map((e, i) => ({ list_id: id!, position: i + 1, item_mbid: mbidOf(e.title), blurb: e.blurb ?? '' }))
      .filter(r => r.item_mbid);
    const { error: entErr } = await db.from('list_entries').insert(rows);
    if (entErr) throw new Error(`entries for ${l.title}: ${entErr.message}`);
    console.log(`  ${l.title} (${rows.length} entries)`);
  }

  console.log('— follows, ratings, comments, likes');
  const pairs = [
    ['nadia', 'marcus'], ['nadia', 'kei'],
    ['marcus', 'nadia'], ['marcus', 'kei'],
    ['kei', 'nadia'], ['kei', 'marcus'],
  ] as const;
  for (const [a, b] of pairs) {
    await db.from('follows').upsert(
      { follower: userIds[a], followee: userIds[b] },
      { onConflict: 'follower,followee', ignoreDuplicates: true },
    );
  }

  const RATINGS: [string, string, number][] = [
    ['nadia', 'Biokinetics', 5], ['nadia', 'Pop', 5], ['nadia', 'Selected Ambient Works 85-92', 4.5],
    ['nadia', 'BCD', 4.5], ['nadia', 'Hongkong', 4], ['nadia', 'Untrue', 4.5],
    ['nadia', 'Music for Nine Post Cards', 4.5], ['nadia', 'Consumed', 4], ['nadia', 'Alcachofa', 4],
    ['nadia', 'Ambient 1: Music for Airports', 4],
    ['marcus', 'Treasure', 5], ['marcus', 'Loveless', 5], ['marcus', 'Souvlaki', 4.5],
    ['marcus', 'Unknown Pleasures', 5], ['marcus', 'Disintegration', 4.5], ['marcus', 'In the Flat Field', 4],
    ['marcus', 'Doolittle', 4.5], ['marcus', 'Chairs Missing', 4], ['marcus', 'Music Has the Right to Children', 4],
    ['marcus', 'Untrue', 4],
    ['kei', 'For You', 5], ['kei', 'Variety', 4.5], ['kei', 'Sunshower', 5], ['kei', 'Mint Jams', 4.5],
    ['kei', 'Clube da Esquina', 5], ['kei', 'Transa', 4.5], ['kei', 'A Tábua de Esmeralda', 4.5],
    ['kei', 'Arthur Verocai', 4], ['kei', 'Journey in Satchidananda', 5], ['kei', 'A Love Supreme', 5],
  ];
  for (const [u, title, value] of RATINGS) {
    const mbid = mbidOf(title);
    if (!mbid) continue;
    await db.from('ratings').upsert(
      { user_id: userIds[u], item_mbid: mbid, value },
      { onConflict: 'user_id,item_mbid' },
    );
  }

  const COMMENTS: [string, string, string][] = [
    ['marcus', 'Concrete & Fog', "Untrue that low is criminal — that's a top five record. Otherwise flawless."],
    ['kei', 'Concrete & Fog', 'Nine Post Cards sneaking into a techno list is exactly right. It all breathes the same air.'],
    ['nadia', 'Cathedrals of Noise', 'No gothic detour in the top five is a bold choice and I respect it.'],
    ['nadia', 'Tokyo Night Drive', 'Mint Jams is the best live record disguised as a studio record ever made.'],
    ['marcus', 'Tokyo Night Drive', 'Came for the neon, stayed for Sunshower.'],
    ['nadia', 'Equatorial', 'Verocai self-titled was a $400 lesson in checking Discogs prices sober.'],
  ];
  for (const [u, listTitle, body] of COMMENTS) {
    const listId = listIds[listTitle];
    if (!listId) continue;
    const { data: dup } = await db
      .from('comments')
      .select('id')
      .eq('list_id', listId)
      .eq('author', userIds[u])
      .eq('body', body)
      .maybeSingle();
    if (!dup) await db.from('comments').insert({ list_id: listId, author: userIds[u], body });
  }

  const LIKES: [string, string][] = [
    ['marcus', 'Concrete & Fog'], ['kei', 'Concrete & Fog'], ['kei', 'Cathedrals of Noise'],
    ['nadia', 'Tokyo Night Drive'], ['marcus', 'Tokyo Night Drive'], ['nadia', 'Equatorial'],
    ['kei', 'Minimal, Maximal'],
  ];
  for (const [u, listTitle] of LIKES) {
    const listId = listIds[listTitle];
    if (!listId) continue;
    await db.from('likes').upsert(
      { user_id: userIds[u], target_type: 'list', target_id: listId },
      { onConflict: 'user_id,target_type,target_id', ignoreDuplicates: true },
    );
  }

  console.log('— pinned top-4');
  const PINS: Record<string, string[]> = {
    nadia: ['Biokinetics', 'Pop', 'Selected Ambient Works 85-92', 'Untrue'],
    marcus: ['Treasure', 'Loveless', 'Doolittle', 'Disintegration'],
    kei: ['For You', 'Clube da Esquina', 'Journey in Satchidananda', 'Sunshower'],
  };
  for (const [u, titles] of Object.entries(PINS)) {
    const pins = titles.map(mbidOf).filter(Boolean) as string[];
    await db.from('profiles').update({ pinned_items: pins }).eq('id', userIds[u]);
  }

  console.log('Seed complete. Demo logins: nadia@demo.runout.local / runout-demo-1 (and marcus…-2, kei…-3).');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
