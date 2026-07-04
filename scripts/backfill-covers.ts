/**
 * Cover backfill — verifies/resolves art for every catalog_items row through
 * the server-side cascade (CAA release-group -> CAA release -> iTunes -> null).
 * Throttled: CAA <=1/1100ms, iTunes <=1/3s, MusicBrainz <=1/1100ms (only used
 * to discover release MBIDs when the release-group check misses).
 *
 * Run: npm run backfill-covers
 * Reports coverage before/after and each remaining miss with the failed step.
 * Tolerates migration 0002 not being applied yet (skips checked_at stamping).
 */
import { createClient } from '@supabase/supabase-js';
import { resolveCover, type CoverCandidate } from '../src/lib/covers';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !serviceKey) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
const db = createClient(url, serviceKey, { auth: { persistSession: false } });
const UA = `Ordko/0.1 ( ${process.env.MB_CONTACT ?? 'contact-not-configured@example.com'} )`;

let lastMB = 0;
async function mb<T>(path: string): Promise<T | null> {
  const wait = Math.max(0, lastMB + 1100 - Date.now());
  if (wait) await new Promise(r => setTimeout(r, wait));
  lastMB = Date.now();
  const res = await fetch(`https://musicbrainz.org/ws/2${path}`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

interface Row {
  mbid: string;
  kind: 'album' | 'song';
  title: string;
  artist_name: string;
  cover_url: string | null;
}

async function releaseMbidsFor(row: Row): Promise<{ rgMbid: string | null; relMbids: string[] }> {
  if (row.kind === 'album') {
    const rg = await mb<{ releases?: { id: string; status?: string; date?: string }[] }>(
      `/release-group/${row.mbid}?inc=releases&fmt=json`,
    );
    const official = (rg?.releases ?? [])
      .filter(r => r.status === 'Official' && r.date)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const pool = official.length ? official : rg?.releases ?? [];
    return { rgMbid: row.mbid, relMbids: pool.slice(0, 3).map(r => r.id) };
  }
  const rec = await mb<{ releases?: { id: string; 'release-group'?: { id: string } }[] }>(
    `/recording/${row.mbid}?inc=releases+release-groups&fmt=json`,
  );
  return {
    rgMbid: rec?.releases?.[0]?.['release-group']?.id ?? null,
    relMbids: (rec?.releases ?? []).slice(0, 3).map(r => r.id),
  };
}

async function main() {
  const { data, error } = await db.from('catalog_items').select('mbid, kind, title, artist_name, cover_url');
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Row[];
  const total = rows.length;
  const before = rows.filter(r => r.cover_url).length;
  console.log(`rows: ${total}; coverage before (unverified URLs counted): ${before}/${total} = ${Math.round((before / Math.max(total, 1)) * 1000) / 10}%`);

  const { error: colErr } = await db.from('catalog_items').select('cover_checked_at').limit(1);
  const stampable = !colErr;
  if (!stampable) console.warn('NOTE: cover_checked_at column missing (migration 0002 not applied) — misses will not be stamped.');

  const misses: { row: Row; step: string }[] = [];
  let verified = 0;
  for (const row of rows) {
    // Discover release MBIDs up front so the full cascade is available.
    const hints = await releaseMbidsFor(row);
    const candidate: CoverCandidate = {
      mbid: row.mbid,
      kind: row.kind,
      title: row.title,
      artist_name: row.artist_name,
      ...hints,
    };
    const { url: coverUrl, step } = await resolveCover(candidate);
    const patch: Record<string, string | null> = stampable
      ? { cover_url: coverUrl, cover_checked_at: new Date().toISOString() }
      : { cover_url: coverUrl };
    const { error: upErr } = await db.from('catalog_items').update(patch).eq('mbid', row.mbid);
    if (upErr) console.error('  persist failed:', row.mbid, upErr.message);
    if (coverUrl) {
      verified++;
      console.log(`  OK  [${step}] ${row.artist_name} — ${row.title}`);
    } else {
      misses.push({ row, step: 'none (all steps failed)' });
      console.log(`  MISS ${row.artist_name} — ${row.title}`);
    }
  }

  console.log(`\ncoverage after (verified): ${verified}/${total} = ${Math.round((verified / Math.max(total, 1)) * 1000) / 10}%`);
  if (misses.length) {
    console.log('remaining misses (rendering the designed placeholder):');
    for (const m of misses) console.log(`  - ${m.row.artist_name} — ${m.row.title} [${m.row.kind}]`);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
