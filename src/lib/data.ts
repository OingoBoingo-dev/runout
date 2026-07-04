import { supabaseServer } from '@/lib/supabase/server';
import type { Activity, CatalogItem, ChartRow, Comment, Kind, List, Profile } from '@/lib/types';

/* Shared read queries. All run under the caller's RLS via the server client. */

export async function getChart(kind: Kind, tag?: string): Promise<ChartRow[]> {
  const supabase = await supabaseServer();
  let q = supabase.from('chart_view').select('*').eq('kind', kind);
  if (tag) q = q.contains('tags', [tag]);
  const { data } = await q
    .order('score', { ascending: false })
    .order('list_count', { ascending: false })
    .order('title', { ascending: true })
    .limit(50);
  return (data ?? []) as ChartRow[];
}

export interface TrendingList {
  list: List;
  owner: Profile;
  covers: (string | null)[];
  titles: string[];
  entryCount: number;
  likeCount: number;
  commentCount: number;
}

export async function getTrending(limit = 12): Promise<TrendingList[]> {
  const supabase = await supabaseServer();
  const { data: lists } = await supabase
    .from('lists')
    .select('*, profiles!lists_owner_fkey(*)')
    .eq('status', 'published')
    .order('updated_at', { ascending: false })
    .limit(40);
  if (!lists?.length) return [];
  const ids = lists.map(l => l.id);
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
  const [{ data: likes }, { data: comments }, { data: entries }] = await Promise.all([
    supabase.from('likes').select('target_id, created_at').eq('target_type', 'list').in('target_id', ids),
    supabase.from('comments').select('list_id, created_at').in('list_id', ids),
    supabase
      .from('list_entries')
      .select('list_id, position, catalog_items(cover_url, title)')
      .in('list_id', ids)
      .lte('position', 4)
      .order('position', { ascending: true }),
  ]);
  const rows = lists.map(l => {
    const lLikes = (likes ?? []).filter(k => k.target_id === l.id);
    const lComments = (comments ?? []).filter(c => c.list_id === l.id);
    const heat =
      lLikes.filter(k => k.created_at >= cutoff).length +
      lComments.filter(c => c.created_at >= cutoff).length;
    const lEntries = (entries ?? []).filter(e => e.list_id === l.id);
    const items = lEntries.map(e => e.catalog_items as unknown as CatalogItem | null);
    return {
      list: l as unknown as List,
      owner: (l as unknown as { profiles: Profile }).profiles,
      covers: items.map(i => i?.cover_url ?? null),
      titles: items.map(i => i?.title ?? ''),
      entryCount: 0, // filled below
      likeCount: lLikes.length,
      commentCount: lComments.length,
      heat,
    };
  });
  const { data: counts } = await supabase.from('list_entries').select('list_id').in('list_id', ids);
  for (const r of rows) r.entryCount = (counts ?? []).filter(c => c.list_id === r.list.id).length;
  return rows
    .sort((a, b) => b.heat - a.heat || b.list.updated_at.localeCompare(a.list.updated_at))
    .slice(0, limit);
}

export interface FeedEntry {
  activity: Activity;
  actor: Profile;
  list?: List & { entryCount: number; covers: (string | null)[] };
  item?: CatalogItem;
  ratingValue?: number;
  targetProfile?: Profile;
  comment?: Comment & { listTitle: string };
}

export async function getFeed(userId: string): Promise<FeedEntry[]> {
  const supabase = await supabaseServer();
  const { data: follows } = await supabase.from('follows').select('followee').eq('follower', userId);
  const followees = (follows ?? []).map(f => f.followee);
  if (!followees.length) return [];
  const { data: acts } = await supabase
    .from('activity')
    .select('*')
    .in('actor', followees)
    .order('created_at', { ascending: false })
    .limit(50);
  const activity = (acts ?? []) as Activity[];
  if (!activity.length) return [];

  const actorIds = [...new Set(activity.map(a => a.actor))];
  const listIds = activity.filter(a => a.verb === 'publish').map(a => a.object_id);
  const itemIds = activity.filter(a => a.verb === 'rate').map(a => a.object_id);
  const profileIds = activity.filter(a => a.verb === 'follow').map(a => a.object_id);
  const commentIds = activity.filter(a => a.verb === 'comment').map(a => a.object_id);

  const [actors, lists, items, targets, comments] = await Promise.all([
    supabase.from('profiles').select('*').in('id', actorIds),
    listIds.length
      ? supabase.from('lists').select('*').in('id', listIds).eq('status', 'published')
      : Promise.resolve({ data: [] }),
    itemIds.length
      ? supabase.from('catalog_items').select('*').in('mbid', itemIds)
      : Promise.resolve({ data: [] }),
    profileIds.length
      ? supabase.from('profiles').select('*').in('id', profileIds)
      : Promise.resolve({ data: [] }),
    commentIds.length
      ? supabase.from('comments').select('*, lists(title, status)').in('id', commentIds)
      : Promise.resolve({ data: [] }),
  ]);

  const publishedListIds = ((lists.data ?? []) as List[]).map(l => l.id);
  const [entriesRes, ratingsRes] = await Promise.all([
    publishedListIds.length
      ? (await supabaseServer())
          .from('list_entries')
          .select('list_id, position, catalog_items(cover_url)')
          .in('list_id', publishedListIds)
          .lte('position', 4)
      : Promise.resolve({ data: [] }),
    itemIds.length
      ? (await supabaseServer()).from('ratings').select('user_id, item_mbid, value').in('item_mbid', itemIds)
      : Promise.resolve({ data: [] }),
  ]);

  const actorMap = new Map(((actors.data ?? []) as Profile[]).map(p => [p.id, p]));
  const listMap = new Map(((lists.data ?? []) as List[]).map(l => [l.id, l]));
  const itemMap = new Map(((items.data ?? []) as CatalogItem[]).map(i => [i.mbid, i]));
  const targetMap = new Map(((targets.data ?? []) as Profile[]).map(p => [p.id, p]));
  const commentRows = (comments.data ?? []) as (Comment & { lists: { title: string; status: string } | null })[];
  const commentMap = new Map(commentRows.map(c => [c.id, c]));
  const entryRows = (entriesRes.data ?? []) as unknown as { list_id: string; position: number; catalog_items: { cover_url: string | null } | null }[];
  const ratingRows = (ratingsRes.data ?? []) as unknown as { user_id: string; item_mbid: string; value: number }[];

  const out: FeedEntry[] = [];
  for (const a of activity) {
    const actor = actorMap.get(a.actor);
    if (!actor) continue;
    if (a.verb === 'publish') {
      const list = listMap.get(a.object_id);
      if (!list) continue;
      const covers = entryRows
        .filter(e => e.list_id === list.id)
        .sort((x, y) => x.position - y.position)
        .map(e => e.catalog_items?.cover_url ?? null);
      const entryCount = 0;
      out.push({ activity: a, actor, list: { ...list, entryCount, covers } });
    } else if (a.verb === 'rate') {
      const item = itemMap.get(a.object_id);
      if (!item) continue;
      const value = ratingRows.find(r => r.user_id === a.actor && r.item_mbid === a.object_id)?.value;
      out.push({ activity: a, actor, item, ratingValue: value });
    } else if (a.verb === 'follow') {
      const targetProfile = targetMap.get(a.object_id);
      if (!targetProfile) continue;
      out.push({ activity: a, actor, targetProfile });
    } else if (a.verb === 'comment') {
      const c = commentMap.get(a.object_id);
      if (!c || !c.lists || c.lists.status !== 'published') continue;
      out.push({ activity: a, actor, comment: { ...c, listTitle: c.lists.title } });
    }
  }
  return out;
}

export async function getProfileByUsername(username: string): Promise<Profile | null> {
  const supabase = await supabaseServer();
  const { data } = await supabase.from('profiles').select('*').eq('username', username).maybeSingle();
  return data as Profile | null;
}
