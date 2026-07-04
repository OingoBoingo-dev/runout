import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';

/**
 * Optional Discogs enrichment — extra credits/label data for an item.
 * Disabled entirely (404) unless DISCOGS_TOKEN is configured.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ mbid: string }> },
) {
  const token = process.env.DISCOGS_TOKEN;
  if (!token) return NextResponse.json({ error: 'Discogs enrichment not enabled' }, { status: 404 });

  const p = z.object({ mbid: z.string().uuid() }).safeParse(await params);
  if (!p.success) return NextResponse.json({ error: 'valid mbid required' }, { status: 400 });

  const supabase = await supabaseServer();
  const { data: item } = await supabase
    .from('catalog_items')
    .select('title, artist_name, year')
    .eq('mbid', p.data.mbid)
    .maybeSingle();
  if (!item) return NextResponse.json({ error: 'Item not in catalog' }, { status: 404 });

  const q = new URLSearchParams({
    q: `${item.artist_name} ${item.title}`,
    type: 'release',
    per_page: '1',
  });
  const res = await fetch(`https://api.discogs.com/database/search?${q}`, {
    headers: {
      Authorization: `Discogs token=${token}`,
      'User-Agent': `Runout/0.1 ( ${process.env.MB_CONTACT ?? ''} )`,
    },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return NextResponse.json({ error: `Discogs ${res.status}` }, { status: 502 });
  const json = (await res.json()) as {
    results?: { title?: string; label?: string[]; year?: string; uri?: string; genre?: string[] }[];
  };
  const hit = json.results?.[0];
  if (!hit) return NextResponse.json({ enrichment: null });
  return NextResponse.json({
    enrichment: {
      title: hit.title ?? null,
      labels: hit.label ?? [],
      year: hit.year ?? null,
      genres: hit.genre ?? [],
      url: hit.uri ? `https://www.discogs.com${hit.uri}` : null,
    },
  });
}
