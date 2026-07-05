import { ImageResponse } from 'next/og';
import { supabaseServer } from '@/lib/supabase/server';
import type { CatalogItem, List, Profile } from '@/lib/types';

export const alt = 'A ranked list on Ordko';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Pressing-plant palette (OG images don't get Tailwind — inline only).
const PAPER = '#FAF6EC';
const INK = '#16150F';
const SECONDARY = '#6F6A5E';
const YELLOW = '#FFC72C';
const COBALT = '#2C4BDF';
const HAIRLINE = 'rgba(22, 21, 15, 0.12)';

const frameStyle = {
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  background: PAPER,
  color: INK,
  padding: '64px 72px',
  fontFamily: 'sans-serif',
} as const;

type ListData = {
  title: string;
  kind: string;
  username: string;
  count: number;
  covers: string[];
};

/** Fetch + shape the list data. Returns null for missing/draft lists or any failure. */
async function loadList(id: string): Promise<ListData | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  try {
    const supabase = await supabaseServer();
    const { data: listRow } = await supabase
      .from('lists')
      .select('*, profiles!lists_owner_fkey(*)')
      .eq('id', id)
      .maybeSingle();

    const list = listRow as unknown as (List & { profiles: Profile }) | null;
    // RLS hides other people's drafts (returns null); also skip drafts explicitly.
    if (!list || list.status === 'draft') return null;

    const { data: entryRows } = await supabase
      .from('list_entries')
      .select('position, catalog_items(*)')
      .eq('list_id', id)
      .order('position', { ascending: true });

    const entries = (entryRows ?? []) as unknown as {
      position: number;
      catalog_items: CatalogItem | null;
    }[];

    return {
      title: list.title,
      kind: list.kind,
      username: list.profiles?.username ?? 'someone',
      count: entries.length,
      // Mosaic = up to 6 stored cover_urls, nulls skipped (never fetch/guess covers).
      covers: entries
        .map(e => e.catalog_items?.cover_url)
        .filter((u): u is string => !!u)
        .slice(0, 6),
    };
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadList(id);

  // Branded fallback for missing/draft lists or any query failure.
  if (!data) {
    return new ImageResponse(
      (
        <div style={frameStyle}>
          <div style={{ display: 'flex', flexDirection: 'column', margin: 'auto' }}>
            <div
              style={{
                display: 'flex',
                fontSize: 26,
                letterSpacing: 6,
                textTransform: 'uppercase',
                color: COBALT,
                marginBottom: 16,
              }}
            >
              Ordko
            </div>
            <div style={{ display: 'flex', fontSize: 64, fontWeight: 800 }}>
              Ranked lists for record obsessives
            </div>
          </div>
        </div>
      ),
      { ...size },
    );
  }

  const { title, kind, username, count, covers } = data;

  return new ImageResponse(
    (
      <div style={frameStyle}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: 24,
            letterSpacing: 6,
            textTransform: 'uppercase',
            color: COBALT,
          }}
        >
          <span style={{ display: 'flex' }}>Ordko</span>
          <span style={{ display: 'flex', color: SECONDARY, marginLeft: 16 }}>· {kind} list</span>
        </div>

        <div style={{ display: 'flex', flex: 1, marginTop: 28 }}>
          {/* Left: title + meta */}
          <div style={{ display: 'flex', flexDirection: 'column', width: 620, paddingRight: 40 }}>
            <div
              style={{
                display: 'flex',
                fontSize: 70,
                fontWeight: 800,
                lineHeight: 1.05,
                overflow: 'hidden',
              }}
            >
              {title}
            </div>
            <div style={{ display: 'flex', marginTop: 'auto', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontSize: 34, color: INK }}>@{username}</div>
              <div style={{ display: 'flex', alignItems: 'center', marginTop: 18 }}>
                <div
                  style={{
                    display: 'flex',
                    background: YELLOW,
                    color: INK,
                    fontSize: 26,
                    fontWeight: 700,
                    padding: '6px 18px',
                    borderRadius: 999,
                  }}
                >
                  {count} {count === 1 ? 'entry' : 'entries'}
                </div>
              </div>
            </div>
          </div>

          {/* Right: cover mosaic (wrap grid of stored covers) */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              width: 428,
              height: 428,
              marginLeft: 'auto',
              borderRadius: 16,
              overflow: 'hidden',
              border: `1px solid ${HAIRLINE}`,
              background: '#FFFFFF',
            }}
          >
            {covers.length > 0 ? (
              covers.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={src}
                  alt=""
                  width={covers.length <= 2 ? 428 : 214}
                  height={covers.length <= 2 ? 428 : 214}
                  style={{ objectFit: 'cover' }}
                />
              ))
            ) : (
              <div
                style={{
                  display: 'flex',
                  width: '100%',
                  height: '100%',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: SECONDARY,
                  fontSize: 28,
                }}
              >
                No covers yet
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
