/* eslint-disable @next/next/no-img-element -- satori/ImageResponse renders raw <img>; next/image does not apply here */
import { ImageResponse } from 'next/og';
import { supabaseServer } from '@/lib/supabase/server';
import type { Profile } from '@/lib/types';

export const alt = 'A collector profile on Ordko';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Pressing-plant palette (OG images don't get Tailwind — inline only).
const PAPER = '#FAF6EC';
const INK = '#16150F';
const SECONDARY = '#6F6A5E';
const YELLOW = '#FFC72C';
const COBALT = '#2C4BDF';
const HAIRLINE = 'rgba(22, 21, 15, 0.12)';

const PANEL = 428; // mosaic panel is PANEL x PANEL
const HALF = PANEL / 2;

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

type ProfileData = {
  name: string;
  username: string;
  listCount: number;
  followers: number;
  covers: string[]; // data: URIs, ready for satori
};

/**
 * Satori does not follow redirects (coverartarchive.org 307s to archive.org),
 * so remote <img> tiles get silently dropped. Fetch the bytes ourselves and
 * inline them as data: URIs. Timeout + skip-on-failure; only stored
 * cover_url values are ever requested — never guessed.
 */
async function fetchCover(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000), redirect: 'follow' });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') ?? 'image/jpeg';
    if (!type.startsWith('image/')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:${type};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

/** Fetch + shape the profile data. Returns null for missing profiles or any failure. */
async function loadProfile(username: string): Promise<ProfileData | null> {
  try {
    const supabase = await supabaseServer();
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', username.toLowerCase())
      .maybeSingle();
    const profile = profileRow as Profile | null;
    if (!profile) return null;

    // Published lists only (newest-published first) + follower count —
    // same tables the profile page uses. Drafts never contribute here.
    const [listsRes, followersRes] = await Promise.all([
      supabase
        .from('lists')
        .select('id, published_at', { count: 'exact' })
        .eq('owner', profile.id)
        .eq('status', 'published')
        .order('published_at', { ascending: false }),
      supabase
        .from('follows')
        .select('follower', { count: 'exact', head: true })
        .eq('followee', profile.id),
    ]);
    const publishedLists = listsRes.data ?? [];
    const listCount = listsRes.count ?? publishedLists.length;
    const followers = followersRes.count ?? 0;

    // Covers: pinned items first (pin order preserved) …
    let coverUrls: string[] = [];
    if (profile.pinned_items.length) {
      const { data: pinRows } = await supabase
        .from('catalog_items')
        .select('mbid, cover_url')
        .in('mbid', profile.pinned_items);
      const byMbid = new Map(
        ((pinRows ?? []) as { mbid: string; cover_url: string | null }[]).map(r => [
          r.mbid,
          r.cover_url,
        ]),
      );
      coverUrls = profile.pinned_items
        .map(m => byMbid.get(m))
        .filter((u): u is string => !!u);
    }
    // … else fall back to the newest PUBLISHED list's entry covers.
    if (!coverUrls.length && publishedLists[0]) {
      const { data: entryRows } = await supabase
        .from('list_entries')
        .select('position, catalog_items(cover_url)')
        .eq('list_id', publishedLists[0].id)
        .order('position', { ascending: true })
        .limit(8);
      coverUrls = (entryRows ?? [])
        .map(e => (e.catalog_items as unknown as { cover_url: string | null } | null)?.cover_url)
        .filter((u): u is string => !!u);
    }

    // Cap at 4 fetches total to keep the route fast; failures just drop out.
    const fetched = await Promise.all(coverUrls.slice(0, 4).map(fetchCover));
    const covers = fetched.filter((u): u is string => !!u);

    return {
      name: profile.display_name || profile.username,
      username: profile.username,
      listCount,
      followers,
      covers,
    };
  } catch {
    return null;
  }
}

const tileStyle = (w: number, h: number) => ({ width: w, height: h, objectFit: 'cover' }) as const;

/**
 * Mosaic tiles with explicit rows — no flex-wrap guesswork, no white voids:
 * 4 covers → 2x2 grid; 2–3 → two half-width full-height tiles side by side;
 * 1 → full-bleed; 0 → "No covers yet" panel.
 */
function mosaicTiles(covers: string[]) {
  if (covers.length >= 4) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex' }}>
          <img src={covers[0]} alt="" style={tileStyle(HALF, HALF)} />
          <img src={covers[1]} alt="" style={tileStyle(HALF, HALF)} />
        </div>
        <div style={{ display: 'flex' }}>
          <img src={covers[2]} alt="" style={tileStyle(HALF, HALF)} />
          <img src={covers[3]} alt="" style={tileStyle(HALF, HALF)} />
        </div>
      </div>
    );
  }
  if (covers.length >= 2) {
    return (
      <div style={{ display: 'flex' }}>
        <img src={covers[0]} alt="" style={tileStyle(HALF, PANEL)} />
        <img src={covers[1]} alt="" style={tileStyle(HALF, PANEL)} />
      </div>
    );
  }
  if (covers.length === 1) {
    return <img src={covers[0]} alt="" style={tileStyle(PANEL, PANEL)} />;
  }
  return (
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
  );
}

export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const data = await loadProfile(username);

  // Branded fallback for missing profiles or any query failure.
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

  const { name, username: handle, listCount, followers, covers } = data;

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
          <span style={{ display: 'flex', color: SECONDARY, marginLeft: 16 }}>· collector</span>
        </div>

        <div style={{ display: 'flex', flex: 1, marginTop: 28 }}>
          {/* Left: display name + handle + counts pill */}
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
              {name}
            </div>
            <div style={{ display: 'flex', fontSize: 34, color: SECONDARY, marginTop: 14 }}>
              @{handle}
            </div>
            <div style={{ display: 'flex', marginTop: 'auto', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
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
                  {listCount} {listCount === 1 ? 'list' : 'lists'} · {followers}{' '}
                  {followers === 1 ? 'follower' : 'followers'}
                </div>
              </div>
            </div>
          </div>

          {/* Right: cover mosaic panel */}
          <div
            style={{
              display: 'flex',
              width: PANEL,
              height: PANEL,
              marginLeft: 'auto',
              borderRadius: 16,
              overflow: 'hidden',
              border: `1px solid ${HAIRLINE}`,
              background: '#FFFFFF',
            }}
          >
            {mosaicTiles(covers)}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
