import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { fetchItemDetail, MBBusyError } from '@/lib/mb';
import { kindSchema } from '@/lib/validate';

const paramsSchema = z.object({ mbid: z.string().uuid() });

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ mbid: string }> },
) {
  const p = paramsSchema.safeParse(await params);
  const kind = kindSchema.safeParse(request.nextUrl.searchParams.get('kind'));
  if (!p.success || !kind.success) {
    return NextResponse.json({ error: 'valid mbid and kind (album|song) required' }, { status: 400 });
  }
  try {
    const detail = await fetchItemDetail(p.data.mbid, kind.data);
    return NextResponse.json(detail);
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
