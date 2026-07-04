import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CommentForm } from '@/components/CommentForm';
import { Cover } from '@/components/Cover';
import { LikeButton } from '@/components/LikeButton';
import { Rank } from '@/components/Rank';
import { fmtCount, fmtInt, fmtYear, timeAgo } from '@/lib/format';
import { supabaseServer } from '@/lib/supabase/server';
import type { CatalogItem, Comment, List, Profile } from '@/lib/types';

export default async function ListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // RLS hides other people's drafts — this returns null for them.
  const { data: listRow } = await supabase
    .from('lists')
    .select('*, profiles!lists_owner_fkey(*)')
    .eq('id', id)
    .maybeSingle();
  if (!listRow) notFound();
  const list = listRow as unknown as List & { profiles: Profile };
  const owner = list.profiles;
  const isOwner = user?.id === list.owner;

  const [{ data: entryRows }, { data: commentRows }, { data: likeRows }] = await Promise.all([
    supabase
      .from('list_entries')
      .select('position, blurb, catalog_items(*)')
      .eq('list_id', id)
      .order('position', { ascending: true }),
    supabase
      .from('comments')
      .select('*, profiles!comments_author_fkey(username, display_name)')
      .eq('list_id', id)
      .order('created_at', { ascending: true }),
    supabase.from('likes').select('user_id, target_type, target_id'),
  ]);

  const entries = (entryRows ?? []) as unknown as {
    position: number;
    blurb: string;
    catalog_items: CatalogItem | null;
  }[];
  const comments = (commentRows ?? []) as unknown as (Comment & {
    profiles: { username: string; display_name: string } | null;
  })[];
  const likes = (likeRows ?? []) as { user_id: string; target_type: string; target_id: string }[];

  const likeCount = (type: string, target: string) =>
    likes.filter(k => k.target_type === type && k.target_id === target).length;
  const likedByMe = (type: string, target: string) =>
    !!user && likes.some(k => k.target_type === type && k.target_id === target && k.user_id === user.id);

  const maxPos = entries.length;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="mb-6">
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-cobalt">
          {list.status === 'draft' ? 'Draft list — only you can see this' : 'List'} · {list.kind}s
        </p>
        <h1 className="font-display text-3xl sm:text-4xl break-words">{list.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <Link
            href={`/u/${owner.username}`}
            className="font-mono text-sm text-ink hover:text-cobalt"
          >
            @{owner.username}
          </Link>
          <span className="font-mono text-xs tabular-nums text-secondary">
            · {fmtCount(entries.length, 'entry', 'entries')} · updated {timeAgo(list.updated_at)}
          </span>
        </div>
        {list.description && <p className="mt-3 max-w-2xl">{list.description}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <LikeButton
            targetType="list"
            targetId={list.id}
            liked={likedByMe('list', list.id)}
            count={likeCount('list', list.id)}
            disabled={!user}
          />
          {isOwner && (
            <Link
              href={`/lists/${list.id}/edit`}
              className="rounded-chip border border-hairline px-4 py-2.5 font-mono text-xs uppercase tracking-wider hover:border-ink/40"
            >
              Edit list
            </Link>
          )}
          {list.status === 'draft' && (
            <span className="rounded-full bg-yellow px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.11em] text-ink">
              draft
            </span>
          )}
        </div>
      </div>

      <div className="stagger divide-y divide-hairline rounded-card border border-hairline bg-card py-1 text-ink">
        {entries.map((e, idx) => {
          const it = e.catalog_items;
          if (!it) return null;
          return (
            <div
              key={e.position}
              className="flex items-center gap-3 px-4 py-3"
              style={{ '--i': Math.min(idx, 20) } as React.CSSProperties}
            >
              <Rank pos={e.position} max={maxPos} sticker={e.position <= 3} />
              <Link href={`/item/${it.mbid}`} className="press flex-none">
                <Cover
                  src={it.cover_url}
                  title={it.title}
                  artist={it.artist_name}
                  className={`zine-sm ${e.position <= 10 ? 'w-20' : 'w-16'}`}
                />
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/item/${it.mbid}`}
                  className="block truncate font-semibold hover:text-cobalt"
                >
                  {it.title}
                </Link>
                <p className="truncate font-mono text-xs tabular-nums text-secondary">
                  {it.artist_name}
                  {fmtYear(it.year) ? ` · ${fmtYear(it.year)}` : ''}
                </p>
                {e.blurb && <p className="mt-1 break-words text-[13.5px] text-ink/80">{e.blurb}</p>}
              </div>
            </div>
          );
        })}
        {entries.length === 0 && (
          <p className="px-4 py-8 text-center font-mono text-sm text-secondary">
            Nothing ranked yet.
          </p>
        )}
      </div>

      <section className="mt-10">
        <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-secondary">
          Comments ({fmtInt(comments.length)})
        </p>
        {user ? (
          <CommentForm listId={list.id} />
        ) : (
          <p className="font-mono text-sm text-secondary">
            <Link href="/login" className="text-cobalt underline underline-offset-4">
              Sign in
            </Link>{' '}
            to join the thread.
          </p>
        )}
        <div className="mt-4 divide-y divide-hairline">
          {comments.map(c => (
            <div key={c.id} className="py-4">
              <p className="font-mono text-[11px] tabular-nums text-secondary">
                <Link href={`/u/${c.profiles?.username ?? ''}`} className="hover:text-ink">
                  @{c.profiles?.username ?? 'unknown'}
                </Link>{' '}
                · {timeAgo(c.created_at)}
              </p>
              <p className="mt-1.5 break-words">{c.body}</p>
              <div className="mt-2">
                <LikeButton
                  targetType="comment"
                  targetId={c.id}
                  liked={likedByMe('comment', c.id)}
                  count={likeCount('comment', c.id)}
                  small
                  disabled={!user}
                />
              </div>
            </div>
          ))}
          {comments.length === 0 && (
            <p className="py-4 font-mono text-xs text-secondary">
              No comments yet — the deadwax is blank.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
