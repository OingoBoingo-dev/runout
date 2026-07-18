import type { SupabaseClient } from '@supabase/supabase-js';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin, requireAdminService } from '@/lib/admin';
import { fmtCount, fmtInt, timeAgo } from '@/lib/format';
import type { Comment, List, ListStatus, Profile } from '@/lib/types';
import { DeleteCommentButton, DeleteListButton, ReviewButtons } from './AdminActions';

const TABS = ['overview', 'lists', 'comments', 'users', 'submissions'] as const;
type Tab = (typeof TABS)[number];

/** Title only resolves for admins — anonymous 404s keep the layout default. */
export async function generateMetadata(): Promise<Metadata> {
  return (await requireAdmin()) ? { title: 'Admin' } : {};
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  // The gate: non-admins (and the pre-0004 world, where is_admin doesn't
  // exist) get a plain 404 — the panel is invisible, never a login redirect.
  const gate = await requireAdminService();
  if (!gate) notFound();
  const { service, profile } = gate;

  const rawTab = (await searchParams).tab as Tab | undefined;
  const tab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : 'overview';

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-cobalt">Admin</p>
      <h1 className="font-display text-3xl">Control room</h1>
      <p className="mt-2 font-mono text-xs text-secondary">
        Signed in as @{profile.username}. Service-role reads — drafts and private lists are
        visible here and nowhere else.
      </p>

      <div className="mt-6 flex gap-0.5 overflow-x-auto border-b border-hairline">
        {TABS.map(t => (
          <Link
            key={t}
            href={t === 'overview' ? '/admin' : `/admin?tab=${t}`}
            aria-current={tab === t}
            className={`whitespace-nowrap px-3.5 py-3 font-mono text-xs uppercase tracking-wider ${
              tab === t ? 'border-b-2 border-cobalt text-ink' : 'text-secondary hover:text-ink'
            }`}
          >
            {t}
          </Link>
        ))}
      </div>

      <div className="mt-5">
        {tab === 'overview' && <OverviewTab service={service} />}
        {tab === 'lists' && <ListsTab service={service} />}
        {tab === 'comments' && <CommentsTab service={service} />}
        {tab === 'users' && <UsersTab service={service} />}
        {tab === 'submissions' && <SubmissionsTab service={service} />}
      </div>
    </div>
  );
}

/* ------------------------------ overview ------------------------------ */

async function OverviewTab({ service }: { service: SupabaseClient }) {
  const head = { count: 'exact' as const, head: true };
  const [users, published, drafts, privates, comments, ratings, items] = await Promise.all([
    service.from('profiles').select('id', head),
    service.from('lists').select('id', head).eq('status', 'published'),
    service.from('lists').select('id', head).eq('status', 'draft'),
    service.from('lists').select('id', head).eq('status', 'private'),
    service.from('comments').select('id', head),
    service.from('ratings').select('user_id', head),
    service.from('catalog_items').select('mbid', head),
  ]);
  const stats: [string, number][] = [
    ['Collectors', users.count ?? 0],
    ['Published lists', published.count ?? 0],
    ['Drafts', drafts.count ?? 0],
    ['Private lists', privates.count ?? 0],
    ['Comments', comments.count ?? 0],
    ['Ratings', ratings.count ?? 0],
    ['Catalog items', items.count ?? 0],
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {stats.map(([label, n]) => (
        <div key={label} className="rounded-card border border-hairline bg-card p-4 text-ink">
          <p className="font-display text-2xl tabular-nums">{fmtInt(n)}</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-secondary">
            {label}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------- lists ------------------------------- */

type AdminListRow = List & {
  profiles: { username: string } | null;
  list_entries: { count: number }[];
};

async function ListsTab({ service }: { service: SupabaseClient }) {
  const { data, error } = await service
    .from('lists')
    .select('*, profiles!lists_owner_fkey(username), list_entries(count)')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return <PanelError note={error.message} />;
  const rows = (data ?? []) as unknown as AdminListRow[];
  if (!rows.length) return <EmptyNote text="No lists on the platter yet." />;
  return (
    <div className="divide-y divide-hairline rounded-card border border-hairline bg-card py-1 text-ink">
      {rows.map(l => (
        <div key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3.5">
          <div className="min-w-0 flex-1 basis-52">
            {l.status === 'published' ? (
              <Link
                href={`/list/${l.id}`}
                className="block truncate font-semibold hover:text-cobalt"
              >
                {l.title}
              </Link>
            ) : (
              // Drafts/private don't link — /list/{id} 404s for everyone but the owner.
              <span className="block truncate font-semibold">{l.title}</span>
            )}
            <p className="mt-0.5 font-mono text-xs tabular-nums text-secondary">
              <Link href={`/u/${l.profiles?.username ?? ''}`} className="hover:text-ink">
                @{l.profiles?.username ?? 'unknown'}
              </Link>
              {' · '}
              {fmtCount(l.list_entries?.[0]?.count ?? 0, 'entry', 'entries')} ·{' '}
              {timeAgo(l.created_at)}
            </p>
          </div>
          <StatusChip status={l.status} />
          <DeleteListButton id={l.id} title={l.title} />
        </div>
      ))}
    </div>
  );
}

/** Same badge language as the list page: yellow draft, ink private. */
function StatusChip({ status }: { status: ListStatus }) {
  const chip = 'rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.11em]';
  if (status === 'draft') return <span className={`${chip} bg-yellow font-semibold text-ink`}>draft</span>;
  if (status === 'private') return <span className={`${chip} bg-ink font-semibold text-paper`}>private</span>;
  return <span className={`${chip} border border-hairline text-secondary`}>published</span>;
}

/* ------------------------------ comments ------------------------------ */

type AdminCommentRow = Comment & {
  profiles: { username: string } | null;
  lists: { id: string; title: string; status: ListStatus } | null;
};

async function CommentsTab({ service }: { service: SupabaseClient }) {
  const { data, error } = await service
    .from('comments')
    .select('*, profiles!comments_author_fkey(username), lists(id, title, status)')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return <PanelError note={error.message} />;
  const rows = (data ?? []) as unknown as AdminCommentRow[];
  if (!rows.length) return <EmptyNote text="No comments anywhere — the deadwax is blank." />;
  return (
    <div className="divide-y divide-hairline rounded-card border border-hairline bg-card py-1 text-ink">
      {rows.map(c => (
        <div key={c.id} className="flex flex-wrap items-start gap-x-3 gap-y-2 px-4 py-3.5">
          <div className="min-w-0 flex-1 basis-52">
            <p className="line-clamp-2 break-words text-[13.5px]">{c.body}</p>
            <p className="mt-1 font-mono text-xs tabular-nums text-secondary">
              <Link href={`/u/${c.profiles?.username ?? ''}`} className="hover:text-ink">
                @{c.profiles?.username ?? 'unknown'}
              </Link>
              {' · on '}
              {c.lists ? (
                c.lists.status === 'published' ? (
                  <Link href={`/list/${c.lists.id}`} className="text-cobalt hover:underline">
                    {c.lists.title}
                  </Link>
                ) : (
                  <span>{c.lists.title}</span>
                )
              ) : (
                'a deleted list'
              )}
              {' · '}
              {timeAgo(c.created_at)}
            </p>
          </div>
          <DeleteCommentButton id={c.id} />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------- users ------------------------------- */

type AdminUserRow = Profile & {
  is_admin?: boolean;
  lists: { count: number }[];
  comments: { count: number }[];
};

async function UsersTab({ service }: { service: SupabaseClient }) {
  const { data, error } = await service
    .from('profiles')
    .select('*, lists!lists_owner_fkey(count), comments!comments_author_fkey(count)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return <PanelError note={error.message} />;
  const rows = (data ?? []) as unknown as AdminUserRow[];
  if (!rows.length) return <EmptyNote text="Nobody here yet." />;
  return (
    <div className="divide-y divide-hairline rounded-card border border-hairline bg-card py-1 text-ink">
      {rows.map(p => (
        <div key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3.5">
          <div className="min-w-0 flex-1 basis-52">
            <p className="truncate">
              <Link href={`/u/${p.username}`} className="font-semibold hover:text-cobalt">
                @{p.username}
              </Link>
              {p.display_name && <span className="text-secondary"> · {p.display_name}</span>}
            </p>
            <p className="mt-0.5 font-mono text-xs tabular-nums text-secondary">
              {fmtCount(p.lists?.[0]?.count ?? 0, 'list')} ·{' '}
              {fmtCount(p.comments?.[0]?.count ?? 0, 'comment')} · joined {timeAgo(p.created_at)}
            </p>
          </div>
          {/* No user actions in v1 — ban/delete is a later, more careful cycle. */}
          {p.is_admin === true && (
            <span className="rounded-full bg-yellow px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.11em] text-ink">
              admin
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------------------------- submissions ---------------------------- */

type SubmissionRow = {
  id: string;
  kind: 'album' | 'artist';
  title: string;
  artist_name: string;
  details: string;
  created_at: string;
  profiles: { username: string } | null;
};

async function SubmissionsTab({ service }: { service: SupabaseClient }) {
  const { data, error } = await service
    .from('submissions')
    .select('*, profiles!submissions_submitted_by_fkey(username)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true }) // FIFO — review in arrival order
    .limit(50);
  if (error) {
    // Pre-0004 the table doesn't exist (PGRST205/42P01) — stay quiet either way.
    return (
      <div className="rounded-card border border-dashed border-hairline p-8 text-center">
        <p className="font-mono text-xs text-secondary">
          Queue arrives once migration 0004 is applied.
        </p>
      </div>
    );
  }
  const rows = (data ?? []) as unknown as SubmissionRow[];
  return (
    <div>
      <p className="mb-3 font-mono text-[10px] leading-relaxed text-secondary">
        approval marks the queue; catalog wiring ships with the submit flow
      </p>
      {rows.length ? (
        <div className="divide-y divide-hairline rounded-card border border-hairline bg-card py-1 text-ink">
          {rows.map(s => (
            <div key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3.5">
              <div className="min-w-0 flex-1 basis-52">
                <p className="truncate font-semibold">
                  {s.title}
                  {s.artist_name && (
                    <span className="font-normal text-secondary"> — {s.artist_name}</span>
                  )}
                </p>
                <p className="mt-0.5 font-mono text-xs tabular-nums text-secondary">
                  <span className="rounded-full border border-hairline px-2 py-0.5 uppercase tracking-[0.11em]">
                    {s.kind}
                  </span>{' '}
                  · @{s.profiles?.username ?? 'unknown'} · {timeAgo(s.created_at)}
                </p>
                {s.details && (
                  <p className="mt-1 line-clamp-2 break-words text-[13.5px] text-ink/80">
                    {s.details}
                  </p>
                )}
              </div>
              <ReviewButtons id={s.id} />
            </div>
          ))}
        </div>
      ) : (
        <EmptyNote text="Queue is clear — nothing pending." />
      )}
    </div>
  );
}

/* ------------------------------ shared ------------------------------ */

function EmptyNote({ text }: { text: string }) {
  return (
    <div className="rounded-card border border-dashed border-hairline p-8 text-center">
      <p className="font-mono text-xs text-secondary">{text}</p>
    </div>
  );
}

function PanelError({ note }: { note: string }) {
  return <p className="font-mono text-xs text-red">Query failed: {note}</p>;
}
