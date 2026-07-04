import { after, NextResponse, type NextRequest } from 'next/server';
import { resolveAndPersist } from '@/lib/covers';
import { asCoverCandidate, MBBusyError, searchMB } from '@/lib/mb';
import { searchSchema } from '@/lib/validate';

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const parsed = searchSchema.safeParse({ kind: params.get('kind'), q: params.get('q') });
  if (!parsed.success) {
    return NextResponse.json({ error: 'kind (album|song) and q are required' }, { status: 400 });
  }
  try {
    const items = await searchMB(parsed.data.kind, parsed.data.q);
    // Resolve missing covers after the response — never blocks the search.
    after(() => resolveAndPersist(items.filter(i => !i.cover_url).map(asCoverCandidate)));
    return NextResponse.json({ items });
  } catch (err) {
    if (err instanceof MBBusyError) {
      return NextResponse.json(
        { error: 'Catalog is busy — retry shortly.' },
        { status: 503, headers: { 'Retry-After': '3' } },
      );
    }
    return NextResponse.json({ error: 'MusicBrainz lookup failed' }, { status: 502 });
  }
}
