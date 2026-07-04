import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Cover } from '@/components/Cover';
import { Stars } from '@/components/Stars';
import { getFeed, type FeedEntry } from '@/lib/data';
import { fmtRating, timeAgo } from '@/lib/format';
import { currentUser } from '@/lib/supabase/server';

export default async function HomePage() {
  const user = await currentUser();
  if (!user) redirect('/explore');

  const feed = await getFeed(user.id);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-cobalt">Home</p>
      <h1 className="font-display text-3xl sm:text-4xl">Fresh from the crates</h1>

      {feed.length === 0 ? (
        <div className="mt-8 rounded-card border border-hairline bg-card p-10 text-center text-ink">
          <h2 className="font-display text-xl">Your crates are quiet</h2>
          <p className="mt-2 text-secondary">
            Follow a few collectors and their lists, ratings and comments will land here.
          </p>
          <Link
            href="/explore"
            className="mt-5 inline-block rounded-chip bg-cobalt px-5 py-3 font-mono text-xs font-semibold uppercase tracking-wider text-paper"
          >
            Browse Explore
          </Link>
        </div>
      ) : (
        <div className="mt-6 divide-y divide-hairline">
          {feed.map(f => (
            <FeedRow key={f.activity.id} f={f} />
          ))}
        </div>
      )}
    </div>
  );
}

function FeedRow({ f }: { f: FeedEntry }) {
  const { activity: a, actor } = f;
  const tag =
    a.verb === 'publish' ? 'list' : a.verb === 'rate' ? 'rated' : a.verb === 'follow' ? 'follow' : 'comment';
  return (
    <article className="flex items-start gap-3 py-4">
      <span className="mt-1.5 flex-none rounded-full border border-hairline px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-secondary">
        {tag}
      </span>
      <div className="min-w-0 flex-1">
        <p className="break-words">
          <Link href={`/u/${actor.username}`} className="font-semibold hover:text-cobalt">
            {actor.display_name || actor.username}
          </Link>{' '}
          {a.verb === 'publish' && f.list && (
            <>
              published{' '}
              <Link href={`/list/${f.list.id}`} className="font-semibold hover:text-cobalt">
                {f.list.title}
              </Link>
            </>
          )}
          {a.verb === 'rate' && f.item && (
            <>
              rated{' '}
              <Link href={`/item/${f.item.mbid}`} className="font-semibold hover:text-cobalt">
                {f.item.title}
              </Link>{' '}
              <Stars value={f.ratingValue ?? 0} size={13} />{' '}
              <span className="font-mono text-sm text-secondary">{fmtRating(f.ratingValue)}</span>
            </>
          )}
          {a.verb === 'follow' && f.targetProfile && (
            <>
              followed{' '}
              <Link href={`/u/${f.targetProfile.username}`} className="font-semibold hover:text-cobalt">
                {f.targetProfile.display_name || f.targetProfile.username}
              </Link>
            </>
          )}
          {a.verb === 'comment' && f.comment && (
            <>
              commented on{' '}
              <Link href={`/list/${f.comment.list_id}`} className="font-semibold hover:text-cobalt">
                {f.comment.listTitle}
              </Link>
            </>
          )}
        </p>
        {a.verb === 'comment' && f.comment && (
          <p className="mt-1 break-words text-sm italic text-secondary">
            “{f.comment.body.length > 120 ? f.comment.body.slice(0, 118) + '…' : f.comment.body}”
          </p>
        )}
        {a.verb === 'publish' && f.list && f.list.covers.length > 0 && (
          <span className="mt-2 flex gap-1">
            {f.list.covers.slice(0, 4).map((c, i) => (
              <Cover key={i} src={c} title={f.list!.title} artist="" className="w-10" />
            ))}
          </span>
        )}
      </div>
      {a.verb === 'rate' && f.item && (
        <Link href={`/item/${f.item.mbid}`} className="flex-none">
          <Cover src={f.item.cover_url} title={f.item.title} artist={f.item.artist_name} className="w-12" />
        </Link>
      )}
      <time className="mt-1.5 flex-none font-mono text-[11px] tabular-nums text-secondary">
        {timeAgo(a.created_at)}
      </time>
    </article>
  );
}
