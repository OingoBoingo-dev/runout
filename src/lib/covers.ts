import PQueue from 'p-queue';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { Kind } from '@/lib/types';

/**
 * Server-side cover resolver. Covers resolve ONCE here and persist to
 * catalog_items.cover_url; clients only ever render that column.
 *
 * Cascade: CAA release-group (verified) -> CAA per-release (first 2-3) ->
 * iTunes Search (artist-token guard) -> null + cover_checked_at stamp.
 * A wrong cover is worse than no cover — never accept a guess.
 *
 * Throttles: Cover Art Archive through its own <=1 req/1100ms queue,
 * iTunes through its own <=1 req/3s queue. (MusicBrainz traffic is NOT
 * issued from this module — callers supply any release MBIDs they know.)
 */

const g = globalThis as unknown as { __caaQueue?: PQueue; __itunesQueue?: PQueue };
const caaQueue = (g.__caaQueue ??= new PQueue({ interval: 1100, intervalCap: 1, concurrency: 1 }));
const itunesQueue = (g.__itunesQueue ??= new PQueue({ interval: 3000, intervalCap: 1, concurrency: 1 }));

const UA = `Ordko/0.1 ( ${process.env.MB_CONTACT ?? 'contact-not-configured@example.com'} )`;

/** HEAD (falling back to GET) an image URL and confirm it actually resolves. */
async function verifyImage(url: string): Promise<boolean> {
  return (await caaQueue.add(async () => {
    try {
      let res = await fetch(url, { method: 'HEAD', redirect: 'follow', headers: { 'User-Agent': UA } });
      if (res.status === 405 || res.status === 403) {
        res = await fetch(url, { method: 'GET', redirect: 'follow', headers: { 'User-Agent': UA, Range: 'bytes=0-0' } });
      }
      return res.ok;
    } catch {
      return false;
    }
  })) as boolean;
}

const tokens = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2 || /^\d+$/.test(w));

function artistOverlap(wanted: string, candidate: string): boolean {
  const want = new Set(tokens(wanted));
  const cand = tokens(candidate);
  // Non-Latin wanted names produce no tokens — accept rather than reject blind.
  if (want.size === 0) return true;
  return cand.some(t => want.has(t));
}

async function itunesArt(kind: Kind, artist: string, title: string): Promise<string | null> {
  return (await itunesQueue.add(async () => {
    try {
      const term = encodeURIComponent(`${artist} ${title}`);
      const entity = kind === 'album' ? 'album' : 'song';
      const res = await fetch(`https://itunes.apple.com/search?term=${term}&entity=${entity}&limit=3`, {
        headers: { 'User-Agent': UA },
      });
      if (!res.ok) return null;
      const json = (await res.json()) as {
        results?: { artworkUrl100?: string; artistName?: string }[];
      };
      const hit = json.results?.find(r => r.artworkUrl100 && artistOverlap(artist, r.artistName ?? ''));
      return hit?.artworkUrl100?.replace('100x100bb', '600x600bb') ?? null;
    } catch {
      return null;
    }
  })) as string | null;
}

export interface CoverCandidate {
  mbid: string;
  kind: Kind;
  title: string;
  artist_name: string;
  /** release-group to try at step 1 (the item's own mbid for albums). */
  rgMbid?: string | null;
  /** release MBIDs for step 2 (first 2-3 are tried). */
  relMbids?: string[];
}

export interface CoverResolution {
  url: string | null;
  step: 'caa-rg' | 'caa-release' | 'itunes' | 'none';
}

export async function resolveCover(item: CoverCandidate): Promise<CoverResolution> {
  const rg = item.kind === 'album' ? item.mbid : item.rgMbid;
  if (rg) {
    const url = `https://coverartarchive.org/release-group/${rg}/front-500`;
    if (await verifyImage(url)) return { url, step: 'caa-rg' };
  }
  for (const rel of (item.relMbids ?? []).slice(0, 3)) {
    const url = `https://coverartarchive.org/release/${rel}/front-500`;
    if (await verifyImage(url)) return { url, step: 'caa-release' };
  }
  const itunes = await itunesArt(item.kind, item.artist_name, item.title);
  if (itunes) return { url: itunes, step: 'itunes' };
  return { url: null, step: 'none' };
}

/* cover_checked_at may not exist until migration 0002 is applied — probe once. */
let checkedColKnown: boolean | null = null;
async function hasCheckedCol(): Promise<boolean> {
  if (checkedColKnown !== null) return checkedColKnown;
  const admin = supabaseAdmin();
  const { error } = await admin.from('catalog_items').select('cover_checked_at').limit(1);
  checkedColKnown = !error;
  return checkedColKnown;
}

/**
 * Resolve and persist covers for items that still lack verified art.
 * Safe to fire-and-forget after a search upsert, or awaited on item pages.
 */
export async function resolveAndPersist(items: CoverCandidate[]): Promise<void> {
  if (!items.length) return;
  const admin = supabaseAdmin();
  const stampable = await hasCheckedCol();
  const { data: rows } = await admin
    .from('catalog_items')
    .select(stampable ? 'mbid, cover_url, cover_checked_at' : 'mbid, cover_url')
    .in('mbid', items.map(i => i.mbid));
  type Row = { mbid: string; cover_url: string | null; cover_checked_at?: string | null };
  const state = new Map(((rows ?? []) as unknown as Row[]).map(r => [r.mbid, r]));

  for (const item of items) {
    const row = state.get(item.mbid);
    if (!row) continue;
    if (row.cover_url) continue; // already has verified art
    if (stampable && row.cover_checked_at) continue; // known miss — don't re-fetch
    const { url } = await resolveCover(item);
    const patch: Record<string, string | null> = stampable
      ? { cover_url: url, cover_checked_at: new Date().toISOString() }
      : { cover_url: url };
    const { error } = await admin.from('catalog_items').update(patch).eq('mbid', item.mbid);
    if (error) console.error('cover persist failed:', item.mbid, error.message);
  }
}
