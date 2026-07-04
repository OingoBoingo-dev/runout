import PQueue from 'p-queue';
import { resolveAndPersist, type CoverCandidate } from '@/lib/covers';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { CatalogItem, Kind, Track } from '@/lib/types';

/**
 * MusicBrainz proxy core. Clients never call MB directly — route handlers and
 * server components go through here. All outbound MB calls are serialized
 * through one queue at <=1 request/1100ms per instance (documented caveat:
 * serverless scale-out means per-instance queues; cache-aside keeps real MB
 * traffic near zero once the catalog warms).
 *
 * Covers are NOT assumed here: rows are upserted without art and the
 * server-side resolver (lib/covers.ts) verifies and persists cover_url.
 */

const MB_ROOT = 'https://musicbrainz.org/ws/2';
const UA = `Ordko/0.1 ( ${process.env.MB_CONTACT ?? 'contact-not-configured@example.com'} )`;

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

/** Catalog row plus transient cover-resolution hints (never persisted). */
export type NormalizedItem = Omit<CatalogItem, 'fetched_at' | 'cover_url'> & {
  cover_url: string | null;
  rgMbid?: string | null;
  relMbids?: string[];
};

function relUrl(
  relations: { type?: string; url?: { resource?: string } }[] | undefined,
  type: string,
): string | null {
  return relations?.find(r => r.type === type && r.url?.resource)?.url?.resource ?? null;
}

function fromReleaseGroup(rg: MBReleaseGroup): NormalizedItem {
  return {
    mbid: rg.id,
    kind: 'album',
    title: rg.title ?? 'Untitled',
    artist_name: artistOf(rg['artist-credit']),
    artist_mbid: artistMbidOf(rg['artist-credit']),
    year: yearOf(rg['first-release-date']),
    primary_type: rg['primary-type'] ?? null,
    cover_url: null,
    wikipedia_url: relUrl(rg.relations, 'wikipedia'),
    discogs_url: relUrl(rg.relations, 'discogs'),
    tags: topTags(rg.tags),
    rgMbid: rg.id,
    relMbids: (rg.releases ?? []).slice(0, 3).map(r => r.id),
  };
}

function fromRecording(rec: MBRecording): NormalizedItem {
  return {
    mbid: rec.id,
    kind: 'song',
    title: rec.title ?? 'Untitled',
    artist_name: artistOf(rec['artist-credit']),
    artist_mbid: artistMbidOf(rec['artist-credit']),
    year: yearOf(rec['first-release-date']),
    primary_type: 'recording',
    cover_url: null,
    wikipedia_url: relUrl(rec.relations, 'wikipedia'),
    discogs_url: relUrl(rec.relations, 'discogs'),
    tags: topTags(rec.tags),
    rgMbid: rec.releases?.[0]?.['release-group']?.id ?? null,
    relMbids: (rec.releases ?? []).slice(0, 3).map(r => r.id),
  };
}

export const asCoverCandidate = (i: NormalizedItem): CoverCandidate => ({
  mbid: i.mbid,
  kind: i.kind as Kind,
  title: i.title,
  artist_name: i.artist_name,
  rgMbid: i.rgMbid ?? null,
  relMbids: i.relMbids ?? [],
});

/* ---------- cache-aside ---------- */

/** Upsert WITHOUT cover fields so verified art is never overwritten. */
async function upsertCatalog(items: NormalizedItem[]) {
  if (!items.length) return;
  const admin = supabaseAdmin();
  const rows = items.map(i => ({
    mbid: i.mbid,
    kind: i.kind,
    title: i.title,
    artist_name: i.artist_name,
    artist_mbid: i.artist_mbid,
    year: i.year,
    primary_type: i.primary_type,
    wikipedia_url: i.wikipedia_url,
    discogs_url: i.discogs_url,
    tags: i.tags,
    fetched_at: new Date().toISOString(),
  }));
  const { error } = await admin.from('catalog_items').upsert(rows, { onConflict: 'mbid' });
  if (error) console.error('catalog upsert failed:', error.message);
}

/* ---------- public API ---------- */

export async function searchMB(kind: Kind, q: string): Promise<NormalizedItem[]> {
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
  // Hand back persisted art where it already exists so results render covers.
  const admin = supabaseAdmin();
  const { data: existing } = await admin
    .from('catalog_items')
    .select('mbid, cover_url')
    .in('mbid', items.map(i => i.mbid));
  const covers = new Map((existing ?? []).map(r => [r.mbid, r.cover_url]));
  return items.map(i => ({ ...i, cover_url: covers.get(i.mbid) ?? null }));
}

export interface ItemDetail {
  item: NormalizedItem;
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
    item.relMbids = (official.length ? official : rg.releases ?? []).slice(0, 3).map(r => r.id);
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
    await resolveAndPersist([asCoverCandidate(item)]);
    return { item, tracks };
  }
  const rec = await mbFetch<MBRecording>(
    `/recording/${mbid}?inc=url-rels+artist-credits+releases+release-groups+tags&fmt=json`,
    86400,
  );
  const item = fromRecording(rec);
  await upsertCatalog([item]);
  await resolveAndPersist([asCoverCandidate(item)]);
  return { item, tracks: [] };
}
