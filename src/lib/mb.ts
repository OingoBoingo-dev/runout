import PQueue from 'p-queue';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { CatalogItem, Kind, Track } from '@/lib/types';

/**
 * MusicBrainz proxy core. Clients never call MB directly — route handlers and
 * server components go through here. All outbound MB calls are serialized
 * through one queue at <=1 request / 1100ms per instance (documented caveat:
 * serverless scale-out means per-instance queues; cache-aside keeps real MB
 * traffic near zero once the catalog warms).
 */

const MB_ROOT = 'https://musicbrainz.org/ws/2';
const UA = `Runout/0.1 ( ${process.env.MB_CONTACT ?? 'contact-not-configured@example.com'} )`;

// Survive dev HMR / route-handler module duplication within an instance.
const g = globalThis as unknown as { __mbQueue?: PQueue };
const queue = (g.__mbQueue ??= new PQueue({ interval: 1100, intervalCap: 1, concurrency: 1 }));

export class MBBusyError extends Error {
  constructor() {
    super('MusicBrainz queue is saturated');
  }
}

async function mbFetch<T>(path: string, revalidate = 3600): Promise<T> {
  if (queue.size > 8) throw new MBBusyError();
  return queue.add(async () => {
    const res = await fetch(`${MB_ROOT}${path}`, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      next: { revalidate },
    });
    if (!res.ok) throw new Error(`MusicBrainz ${res.status}`);
    return (await res.json()) as T;
  }) as Promise<T>;
}

/* ---------- normalization ---------- */

interface MBArtistCredit {
  name?: string;
  joinphrase?: string;
  artist?: { id?: string; name?: string };
}
interface MBTag {
  name: string;
  count?: number;
}
interface MBReleaseGroup {
  id: string;
  title?: string;
  'first-release-date'?: string;
  'primary-type'?: string;
  'artist-credit'?: MBArtistCredit[];
  tags?: MBTag[];
  releases?: { id: string; status?: string; date?: string }[];
  relations?: { type?: string; url?: { resource?: string } }[];
}
interface MBRecording {
  id: string;
  title?: string;
  'first-release-date'?: string;
  'artist-credit'?: MBArtistCredit[];
  tags?: MBTag[];
  releases?: { id: string; 'release-group'?: { id: string } }[];
  relations?: { type?: string; url?: { resource?: string } }[];
}

const artistOf = (ac?: MBArtistCredit[]) =>
  (ac ?? []).map(c => (c.name ?? c.artist?.name ?? '') + (c.joinphrase ?? '')).join('') ||
  'Unknown artist';

const artistMbidOf = (ac?: MBArtistCredit[]) => ac?.[0]?.artist?.id ?? null;

const topTags = (tags?: MBTag[]) =>
  (tags ?? [])
    .slice()
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
    .slice(0, 5)
    .map(t => t.name.toLowerCase());

const yearOf = (d?: string) => {
  const y = Number((d ?? '').slice(0, 4));
  return Number.isInteger(y) && y > 0 ? y : null;
};

export const caaCover = (rgMbid: string) =>
  `https://coverartarchive.org/release-group/${rgMbid}/front-500`;

type UpsertItem = Omit<CatalogItem, 'fetched_at'>;

function fromReleaseGroup(rg: MBReleaseGroup): UpsertItem {
  return {
    mbid: rg.id,
    kind: 'album',
    title: rg.title ?? 'Untitled',
    artist_name: artistOf(rg['artist-credit']),
    artist_mbid: artistMbidOf(rg['artist-credit']),
    year: yearOf(rg['first-release-date']),
    primary_type: rg['primary-type'] ?? null,
    cover_url: caaCover(rg.id),
    wikipedia_url: relUrl(rg.relations, 'wikipedia'),
    discogs_url: relUrl(rg.relations, 'discogs'),
    tags: topTags(rg.tags),
  };
}

function fromRecording(rec: MBRecording): UpsertItem {
  const rgId = rec.releases?.[0]?.['release-group']?.id ?? null;
  return {
    mbid: rec.id,
    kind: 'song',
    title: rec.title ?? 'Untitled',
    artist_name: artistOf(rec['artist-credit']),
    artist_mbid: artistMbidOf(rec['artist-credit']),
    year: yearOf(rec['first-release-date']),
    primary_type: 'recording',
    cover_url: rgId ? caaCover(rgId) : null,
    wikipedia_url: relUrl(rec.relations, 'wikipedia'),
    discogs_url: relUrl(rec.relations, 'discogs'),
    tags: topTags(rec.tags),
  };
}

function relUrl(
  relations: { type?: string; url?: { resource?: string } }[] | undefined,
  type: string,
): string | null {
  return relations?.find(r => r.type === type && r.url?.resource)?.url?.resource ?? null;
}

/* ---------- cache-aside ---------- */

async function upsertCatalog(items: UpsertItem[]) {
  if (!items.length) return;
  const admin = supabaseAdmin();
  const { error } = await admin
    .from('catalog_items')
    .upsert(items.map(i => ({ ...i, fetched_at: new Date().toISOString() })), { onConflict: 'mbid' });
  if (error) console.error('catalog upsert failed:', error.message);
}

/* ---------- public API ---------- */

export async function searchMB(kind: Kind, q: string): Promise<UpsertItem[]> {
  const enc = encodeURIComponent(q);
  const items =
    kind === 'album'
      ? ((await mbFetch<{ 'release-groups'?: MBReleaseGroup[] }>(
          `/release-group?query=${enc}&fmt=json&limit=12`,
        ))['release-groups'] ?? []).map(fromReleaseGroup)
      : ((await mbFetch<{ recordings?: MBRecording[] }>(
          `/recording?query=${enc}&fmt=json&limit=12`,
        )).recordings ?? []).map(fromRecording);
  // Search results seed the catalog so list entries can reference them (FK).
  await upsertCatalog(items);
  return items;
}

export interface ItemDetail {
  item: UpsertItem;
  tracks: Track[];
}

/** Full lookup: metadata + (albums) tracklist from the earliest official release. */
export async function fetchItemDetail(mbid: string, kind: Kind): Promise<ItemDetail> {
  if (kind === 'album') {
    const rg = await mbFetch<MBReleaseGroup>(
      `/release-group/${mbid}?inc=url-rels+artist-credits+releases+tags&fmt=json`,
      86400,
    );
    const item = fromReleaseGroup(rg);
    const official = (rg.releases ?? [])
      .filter(r => r.status === 'Official' && r.date)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const rel = official[0] ?? (rg.releases ?? []).find(r => r.status === 'Official') ?? rg.releases?.[0];
    let tracks: Track[] = [];
    if (rel) {
      try {
        const rj = await mbFetch<{
          media?: { tracks?: { position?: number; title?: string; length?: number }[] }[];
        }>(`/release/${rel.id}?inc=recordings&fmt=json`, 86400);
        tracks = (rj.media ?? []).flatMap(m =>
          (m.tracks ?? []).map(t => ({
            pos: t.position ?? '',
            title: t.title ?? '',
            len: t.length ?? null,
          })),
        );
      } catch {
        // keep metadata; tracklist stays unavailable
      }
    }
    await upsertCatalog([item]);
    return { item, tracks };
  }
  const rec = await mbFetch<MBRecording>(
    `/recording/${mbid}?inc=url-rels+artist-credits+releases+release-groups+tags&fmt=json`,
    86400,
  );
  const item = fromRecording(rec);
  await upsertCatalog([item]);
  return { item, tracks: [] };
}
