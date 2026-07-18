import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdoptTheme } from '@/components/AdoptTheme';
import { ArtistLink } from '@/components/ArtistLink';
import { Cover } from '@/components/Cover';
import { FollowButton } from '@/components/FollowButton';
import { ProfileBanner } from '@/components/ProfileBanner';
import { SignOutButton } from '@/components/SignOutButton';
import { Stars } from '@/components/Stars';
import { AvatarFrame } from '@/lib/borders';
import { getProfileByUsername } from '@/lib/data';
import { fmtCount, fmtInt, fmtRating, timeAgo } from '@/lib/format';
import { supabaseServer } from '@/lib/supabase/server';
import type { CatalogItem, List, Rating } from '@/lib/types';

const TABS = ['lists', 'ratings', 'activity'] as const;
type Tab = (typeof TABS)[number];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfileByUsername(username.toLowerCase());
  if (!profile) return {};

  const name = profile.display_name || profile.username;
  const title = `${name} on Ordko`;
  const description = `Ranked lists and ratings by @${profile.username}`;

  return {
    title: name,
    description,
    openGraph: { title, description, type: 'profile', username: profile.username },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { username } = await params;
  const rawTab = (await searchParams).tab as Tab | undefined;
  const tab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : 'lists';

  const profile = await getProfileByUsername(username.toLowerCase());
  if (!profile) notFound();

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const own = user?.id === profile.id;

  const [listsRes, ratingsRes, followerRes, followingRes, pinsRes, myFollowRes] = await Promise.all([
    supabase
      .from('lists')
      .select('*')
      .eq('owner', profile.id)
      .order('updated_at', { ascending: false }),
    supabase
      .from('ratings')
      .select('*, catalog_items(*)')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(60),
    supabase.from('follows').select('follower', { count: 'exact', head: true }).eq('followee', profile.id),
    supabase.from('follows').select('followee', { count: 'exact', head: true }).eq('follower', profile.id),
    profile.pinned_items.length
      ? supabase.from('catalog_items').select('*').in('mbid', profile.pinned_items)
      : Promise.resolve({ data: [] }),
    user && !own
      ? supabase
          .from('follows')
          .select('followee')
          .eq('follower', user.id)
          .eq('followee', profile.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const lists = ((listsRes.data ?? []) as List[]).filter(l => own || l.status === 'published');
  const pubCount = lists.filter(l => l.status === 'published').length;
  const ratings = (ratingsRes.data ?? []) as unknown as (Rating & { catalog_items: CatalogItem | null })[];
  const followers = followerRes.count ?? 0;
  const following = followingRes.count ?? 0;
  const pins = profile.pinned_items
    .map(m => ((pinsRes.data ?? []) as CatalogItem[]).find(i => i.mbid === m))
    .filter(Boolean) as CatalogItem[];
  const iFollow = !!myFollowRes.data;

  const entryCounts = new Map<string, number>();
  if (lists.length) {
    const { data: counts } = await supabase
      .from('list_entries')
      .select('list_id')
      .in('list_id', lists.map(l => l.id));
    for (const l of lists)
      entryCounts.set(l.id, (counts ?? []).filter(c => c.list_id === l.id).length);
  }

  // Banner covers: pins first; else the newest published list's first covers
  // (one narrow query, only when needed); else no banner at all.
  let bannerCovers: (string | null)[] = pins.map(p => p.cover_url);
  if (!bannerCovers.some(Boolean)) {
    const newestPublished = lists
      .filter(l => l.status === 'published')
      .slice()
      .sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))[0];
    if (newestPublished) {
      const { data: bannerEntries } = await supabase
        .from('list_entries')
        .select('position, catalog_items(cover_url)')
        .eq('list_id', newestPublished.id)
        .order('position', { ascending: true })
        .limit(5);
      bannerCovers = (bannerEntries ?? []).map(
        e => (e.catalog_items as unknown as { cover_url: string | null } | null)?.cover_url ?? null
      );
    }
  }
  const backgroundUrl = profile.background_url ?? null;
  const hasBanner = !!backgroundUrl || bannerCovers.some(Boolean);

  const monogram =
    (profile.display_name || profile.username)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0])
      .join('')
      .toUpperCase() || '?';

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      {/* Visitors adopt this profile's scheme while here; undefined until
          migration 0003 lands → null → no-op. */}
      <AdoptTheme scheme={profile.theme_scheme ?? null} />
      <div className="relative">
        {backgroundUrl ? (
          /* Chosen background image: barely blurred (it's deliberate, unlike the
             derived cover strip), same paper-wash gradients for ink legibility. */
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-[118px] overflow-hidden rounded-card sm:h-[150px]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={backgroundUrl}
              alt=""
              aria-hidden
              loading="lazy"
              className="h-full w-full scale-105 object-cover opacity-80 blur-[3px]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-paper via-paper/70 to-paper/25" />
            <div className="absolute inset-0 bg-gradient-to-r from-paper/80 via-paper/35 to-transparent" />
          </div>
        ) : (
          <ProfileBanner covers={bannerCovers} />
        )}
        <div className={`flex flex-wrap items-start gap-5${hasBanner ? ' relative p-4 sm:p-5' : ''}`}>
          {/* border_id null/unknown → AvatarFrame renders the plain 76px
              circle exactly as before; a frame draws its annulus around it. */}
          <AvatarFrame borderId={profile.border_id} size={76}>
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt=""
                loading="lazy"
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <span
                aria-hidden
                className="flex h-full w-full items-center justify-center rounded-full bg-ink font-mono text-2xl font-semibold text-paper"
              >
                {monogram}
              </span>
            )}
          </AvatarFrame>
          <div className="min-w-[220px] flex-1">
            <h1 className="font-display text-3xl">{profile.display_name || profile.username}</h1>
            <p className="mt-1 font-mono text-[13px] text-secondary">@{profile.username}</p>
            {profile.bio && <p className="mt-2 max-w-xl">{profile.bio}</p>}
            <p className="mt-4 font-mono text-[12.5px] tabular-nums text-secondary">
              <b className="font-semibold text-ink">{fmtInt(pubCount)}</b>{' '}
              {pubCount === 1 ? 'list' : 'lists'} ·{' '}
              <b className="font-semibold text-ink">{fmtInt(ratings.length)}</b>{' '}
              {ratings.length === 1 ? 'rating' : 'ratings'} ·{' '}
              <b className="font-semibold text-ink">{fmtInt(followers)}</b>{' '}
              {followers === 1 ? 'follower' : 'followers'} ·{' '}
              <b className="font-semibold text-ink">{fmtInt(following)}</b> following
            </p>
            <div className="mt-4 flex gap-2">
              {own ? (
                <>
                  <Link
                    href="/settings"
                    className="rounded-chip border border-hairline px-4 py-2.5 font-mono text-xs uppercase tracking-wider hover:border-ink/40"
                  >
                    Edit profile
                  </Link>
                  <SignOutButton />
                </>
              ) : user ? (
                <FollowButton userId={profile.id} username={profile.username} following={iFollow} />
              ) : (
                <Link
                  href="/login"
                  className="rounded-chip border border-hairline px-4 py-2.5 font-mono text-xs uppercase tracking-wider hover:border-ink/40"
                >
                  Sign in to follow
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      <section className="mt-8">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-secondary">
          Pinned top 4
        </p>
        {pins.length ? (
          <div className="grid max-w-xl grid-cols-4 gap-2">
            {pins.map(p => (
              <Link key={p.mbid} href={`/item/${p.mbid}`} aria-label={p.title}>
                <Cover src={p.cover_url} title={p.title} artist={p.artist_name} className="w-full rounded-card" size={500} />
              </Link>
            ))}
          </div>
        ) : (
          <p className="font-mono text-xs text-secondary">
            <span className="rounded-full border border-dashed border-secondary px-3 py-1 uppercase tracking-[0.11em]">
              nothing pinned yet
            </span>
          </p>
        )}
      </section>

      <div className="mt-8 flex gap-0.5 border-b border-hairline">
        {TABS.map(t => (
          <Link
            key={t}
            href={`/u/${profile.username}${t === 'lists' ? '' : `?tab=${t}`}`}
            aria-current={tab === t}
            className={`px-4 py-3 font-mono text-xs uppercase tracking-wider ${
              tab === t ? 'border-b-2 border-cobalt text-ink' : 'text-secondary hover:text-ink'
            }`}
          >
            {t}
          </Link>
        ))}
      </div>

      <div className="mt-5">
        {tab === 'lists' &&
          (lists.length ? (
            <div className="divide-y divide-hairline rounded-card border border-hairline bg-card py-1 text-ink">
              {lists.map(l => (
                <Link key={l.id} href={`/list/${l.id}`} className="group flex items-center gap-3 px-4 py-3.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold group-hover:text-cobalt">
                      {l.title}
                    </span>
                    <span className="block font-mono text-xs tabular-nums text-secondary">
                      {l.kind}s · {fmtCount(entryCounts.get(l.id) ?? 0, 'entry', 'entries')} · updated{' '}
                      {timeAgo(l.updated_at)}
                    </span>
                  </span>
                  {l.status === 'draft' && (
                    <span className="rounded-full bg-yellow px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.11em] text-ink">
                      draft
                    </span>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <EmptyCard
              title="No lists yet"
              body={own ? 'Rank something. Anything. Start with ten.' : 'Nothing published so far.'}
              cta={own ? { href: '/lists/new', label: 'Start a list' } : undefined}
            />
          ))}

        {tab === 'ratings' &&
          (ratings.length ? (
            <div className="divide-y divide-hairline rounded-card border border-hairline bg-card py-1 text-ink">
              {ratings.map(r => {
                const it = r.catalog_items;
                if (!it) return null;
                return (
                  /* Stretched-link row: overlay navigates to the item (z-[1],
                     above the positioned Cover); artist link stays clickable
                     at z-10. */
                  <div key={r.item_mbid} className="group relative flex items-center gap-3 px-4 py-3">
                    <Link
                      href={`/item/${it.mbid}`}
                      aria-label={it.title}
                      className="absolute inset-0 z-[1]"
                    />
                    <Cover src={it.cover_url} title={it.title} artist={it.artist_name} className="w-12 flex-none" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold group-hover:text-cobalt">{it.title}</span>
                      <span className="block truncate font-mono text-xs text-secondary">
                        <ArtistLink name={it.artist_name} mbid={it.artist_mbid} className="relative z-10" />
                      </span>
                    </span>
                    <Stars value={Number(r.value)} size={14} />
                    <span className="font-mono text-xs tabular-nums text-secondary">{fmtRating(Number(r.value))}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyCard
              title="No ratings yet"
              body={own ? 'Find an album and tap some stars.' : 'This collector hasn’t rated anything.'}
              cta={own ? { href: '/explore', label: 'Find something to rate' } : undefined}
            />
          ))}

        {tab === 'activity' && <ActivityTab profileId={profile.id} />}
      </div>
    </div>
  );
}

function EmptyCard({ title, body, cta }: { title: string; body: string; cta?: { href: string; label: string } }) {
  return (
    <div className="rounded-card border border-hairline bg-card p-10 text-center text-ink">
      <h2 className="font-display text-xl">{title}</h2>
      <p className="mt-2 text-secondary">{body}</p>
      {cta && (
        <Link
          href={cta.href as '/explore'}
          className="mt-4 inline-block rounded-chip bg-cobalt px-5 py-3 font-mono text-xs font-semibold uppercase tracking-wider text-paper"
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}

async function ActivityTab({ profileId }: { profileId: string }) {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from('activity')
    .select('*')
    .eq('actor', profileId)
    .order('created_at', { ascending: false })
    .limit(40);
  const acts = data ?? [];
  if (!acts.length) {
    return <p className="font-mono text-xs text-secondary">Nothing on the ledger yet.</p>;
  }
  return (
    <div className="divide-y divide-hairline">
      {acts.map(a => (
        <p key={a.id} className="flex items-center gap-3 py-3.5">
          <span className="flex-none rounded-full border border-hairline px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-secondary">
            {a.verb}
          </span>
          <span className="flex-1 font-mono text-sm text-secondary">
            {a.verb === 'publish' && 'published a list'}
            {a.verb === 'rate' && 'rated a record'}
            {a.verb === 'follow' && 'followed a collector'}
            {a.verb === 'comment' && 'commented on a list'}
          </span>
          <time className="font-mono text-[11px] tabular-nums text-secondary">{timeAgo(a.created_at)}</time>
        </p>
      ))}
    </div>
  );
}
