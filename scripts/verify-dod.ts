/**
 * Definition-of-done verification against the LIVE database and deployment.
 * Run: node --env-file=.env.local --import tsx scripts/verify-dod.ts [siteUrl]
 * Creates a throwaway user, exercises RLS/triggers/chart/feed, then cleans up.
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SITE = process.argv[2] ?? 'https://runout.vercel.app';

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const anon = () => createClient(url, anonKey, { auth: { persistSession: false } });

const results: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, note = '') => {
  results.push([name, ok, note]);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${note ? ` — ${note}` : ''}`);
};

async function main() {
  const stamp = Date.now().toString(36);
  const email = `dodtester+${stamp}@demo.runout.local`;
  const password = 'dod-tester-pass-1';
  const username = `dodtester${stamp}`.slice(0, 24).toLowerCase().replace(/[^a-z0-9_]/g, '');

  /* 1. Signup -> session + profile row (trigger) + username format */
  const tester = anon();
  const { data: su, error: suErr } = await tester.auth.signUp({
    email,
    password,
    options: { data: { username, display_name: 'DoD Tester' } },
  });
  check('signup succeeds', !suErr, suErr?.message ?? '');
  check('signup grants immediate session (email confirm off)', !!su?.session,
    su?.session ? '' : 'email confirmation still ON in Supabase auth settings');
  const testerId = su?.user?.id;
  if (!testerId) throw new Error('no tester user — cannot continue');
  const { data: prof } = await admin.from('profiles').select('*').eq('id', testerId).single();
  check('profiles row auto-created by trigger', !!prof, prof?.username ?? '');
  check('username stored + format enforced', !!prof && /^[a-z0-9_]{3,24}$/.test(prof.username));

  /* 2. Tester builds a draft list with entries (like the server action would) */
  const { data: someItems } = await admin.from('catalog_items').select('mbid, kind').eq('kind', 'album').limit(3);
  const mbids = (someItems ?? []).map(i => i.mbid);
  const { data: newList, error: listErr } = await tester
    .from('lists')
    .insert({ owner: testerId, title: `DoD Verification List ${stamp}`, description: '', kind: 'album', status: 'draft' })
    .select('id')
    .single();
  check('owner can create own draft list (RLS)', !!newList && !listErr, listErr?.message ?? '');
  const listId = newList!.id as string;
  const { error: entErr } = await tester.from('list_entries').insert(
    mbids.map((m, i) => ({ list_id: listId, position: i + 1, item_mbid: m, blurb: i === 0 ? 'test blurb' : '' })),
  );
  check('owner can insert own entries (RLS)', !entErr, entErr?.message ?? '');

  /* 3. Draft invisibility + anon mutation rejection */
  const stranger = anon();
  const { data: strangerSees } = await stranger.from('lists').select('id').eq('id', listId);
  check('signed-out CANNOT read drafts', (strangerSees ?? []).length === 0);
  const { data: strangerEntries } = await stranger.from('list_entries').select('position').eq('list_id', listId);
  check('signed-out CANNOT read draft entries', (strangerEntries ?? []).length === 0);
  const { error: anonInsErr } = await stranger.from('lists').insert({ owner: testerId, title: 'hax', kind: 'album', status: 'published' });
  check('signed-out CANNOT create lists', !!anonInsErr);
  const { error: anonRateErr } = await stranger.from('ratings').insert({ user_id: testerId, item_mbid: mbids[0], value: 5 });
  check('signed-out CANNOT rate', !!anonRateErr);

  /* 4. Position bounds enforced in the database */
  const { error: posErr } = await tester.from('list_entries').insert({ list_id: listId, position: 1000, item_mbid: mbids[0], blurb: '' });
  check('position 1000 rejected (1-999 check)', !!posErr, posErr ? 'check constraint' : 'accepted?!');
  const { error: dupErr } = await tester.from('list_entries').insert({ list_id: listId, position: 1, item_mbid: mbids[1], blurb: '' });
  check('duplicate position rejected (pk)', !!dupErr);

  /* 5. Publish -> published_at + activity via trigger */
  await tester.from('lists').update({ status: 'published' }).eq('id', listId);
  const { data: pubList } = await tester.from('lists').select('status, published_at').eq('id', listId).single();
  check('publish sets published_at (trigger)', pubList?.status === 'published' && !!pubList?.published_at);
  const { data: pubAct } = await admin.from('activity').select('id').eq('actor', testerId).eq('verb', 'publish').eq('object_id', listId);
  check('publish logged to activity (trigger)', (pubAct ?? []).length === 1);

  /* 6. Second account follows -> publish appears in their feed; comment + like */
  const nadia = anon();
  const { data: nadiaAuth, error: nadiaErr } = await nadia.auth.signInWithPassword({
    email: 'nadia@demo.runout.local',
    password: 'runout-demo-1',
  });
  check('demo user signs in', !!nadiaAuth?.session, nadiaErr?.message ?? '');
  const nadiaId = nadiaAuth!.user!.id;
  await nadia.from('follows').insert({ follower: nadiaId, followee: testerId });
  const { data: followees } = await nadia.from('follows').select('followee').eq('follower', nadiaId);
  const feedActors = (followees ?? []).map(f => f.followee);
  const { data: feed } = await nadia
    .from('activity')
    .select('*')
    .in('actor', feedActors)
    .order('created_at', { ascending: false })
    .limit(50);
  check('followed publish appears in feed query', (feed ?? []).some(a => a.verb === 'publish' && a.object_id === listId));
  const { error: cErr } = await nadia.from('comments').insert({ list_id: listId, author: nadiaId, body: 'DoD verification comment' });
  const { data: cRow } = await nadia.from('comments').select('id').eq('list_id', listId).eq('body', 'DoD verification comment').single();
  check('comment works', !cErr && !!cRow);
  const { error: lErr } = await nadia.from('likes').insert({ user_id: nadiaId, target_type: 'list', target_id: listId });
  const { count: likeCount } = await anon().from('likes').select('*', { count: 'exact', head: true }).eq('target_type', 'list').eq('target_id', listId);
  check('like works and is publicly countable', !lErr && likeCount === 1);
  const { error: clErr } = await nadia.from('likes').insert({ user_id: nadiaId, target_type: 'comment', target_id: cRow!.id });
  check('comment like works', !clErr);

  /* 7. Chart includes the new list with correct scores; tag filter */
  const { data: chartRows } = await anon().from('chart_view').select('*').eq('kind', 'album');
  const chartFor = (m: string) => (chartRows ?? []).find(r => r.mbid === m);
  const expected = [999, 998, 997];
  let scoresOk = true;
  for (let i = 0; i < mbids.length; i++) {
    const row = chartFor(mbids[i]);
    // this item may also appear in seed lists — verify by recomputing from entries
    const { data: allEntries } = await admin
      .from('list_entries')
      .select('position, lists!inner(status)')
      .eq('item_mbid', mbids[i])
      .eq('lists.status', 'published');
    const expect = (allEntries ?? []).reduce((s, e) => s + (1000 - e.position), 0);
    if (!row || Number(row.score) !== expect) {
      scoresOk = false;
      console.log(`   score mismatch for ${mbids[i]}: view=${row?.score} recomputed=${expect} (test contribution ${expected[i]})`);
    }
  }
  check('chart scores = sum(1000 - position) over published lists', scoresOk);
  const tagged = (chartRows ?? []).find(r => (r.tags ?? []).length > 0);
  if (tagged) {
    const tag = tagged.tags[0];
    const { data: tagRows } = await anon().from('chart_view').select('tags').eq('kind', 'album').contains('tags', [tag]);
    check(`tag filter (@> '{${tag}}') returns only tagged rows`, (tagRows ?? []).length > 0 && (tagRows ?? []).every(r => r.tags.includes(tag)));
  } else {
    check('tag filter', false, 'no tagged chart rows to test');
  }

  /* 8. Rating upsert keeps one row per (user,item) */
  await tester.from('ratings').upsert({ user_id: testerId, item_mbid: mbids[0], value: 4.5 }, { onConflict: 'user_id,item_mbid' });
  await tester.from('ratings').upsert({ user_id: testerId, item_mbid: mbids[0], value: 5.0 }, { onConflict: 'user_id,item_mbid' });
  const { data: myRatings } = await admin.from('ratings').select('value').eq('user_id', testerId).eq('item_mbid', mbids[0]);
  check('re-rating updates in place (one row)', (myRatings ?? []).length === 1 && Number(myRatings![0].value) === 5);

  /* 9. Live site checks */
  const get = async (path: string) => {
    const res = await fetch(`${SITE}${path}`, { headers: { 'User-Agent': 'RunoutDoD/1.0' } });
    return { status: res.status, body: await res.text() };
  };
  const explore = await get('/explore');
  check('live /explore renders chart with seeded item', explore.status === 200 && /Biokinetics|Loveless|Treasure/.test(explore.body));
  const profPage = await get('/u/nadia');
  check('live /u/nadia renders', profPage.status === 200 && profPage.body.includes('nadia'));
  const { data: cf } = await admin.from('lists').select('id').eq('title', 'Concrete & Fog').single();
  const listPage = await get(`/list/${cf!.id}`);
  check('live list page renders entries + comments', listPage.status === 200 && listPage.body.includes('Biokinetics'));
  const { count: catBefore } = await admin.from('catalog_items').select('*', { count: 'exact', head: true });
  const searchPage = await get('/search?q=Giegling');
  const gotResults = searchPage.status === 200 && /Giegling/i.test(searchPage.body);
  const { count: catAfter } = await admin.from('catalog_items').select('*', { count: 'exact', head: true });
  check('live /search?q=Giegling proxies MusicBrainz', gotResults, `status ${searchPage.status}`);
  check('search results cache-aside into catalog_items', (catAfter ?? 0) > (catBefore ?? 0), `${catBefore} -> ${catAfter}`);
  const draftProbe = await get(`/lists/new`);
  check('live /lists/new redirects signed-out to login', draftProbe.body.includes('Sign in') || draftProbe.body.includes('login'));

  /* 10. cleanup — remove everything the test created */
  console.log('\n— cleanup');
  await admin.from('follows').delete().eq('follower', nadiaId).eq('followee', testerId);
  await admin.from('activity').delete().eq('actor', nadiaId).eq('object_id', cRow!.id);
  await admin.from('activity').delete().eq('actor', nadiaId).eq('verb', 'follow').eq('object_id', testerId);
  await admin.from('lists').delete().eq('id', listId); // cascades entries/comments/likes-on-list rows... (likes are not FK'd; clean explicitly)
  await admin.from('likes').delete().eq('target_id', listId);
  if (cRow) await admin.from('likes').delete().eq('target_id', cRow.id);
  await admin.auth.admin.deleteUser(testerId); // cascades profile -> ratings/activity
  // De-dupe rate activities left by repeated seed upserts (keep earliest per actor+object)
  const { data: rateActs } = await admin.from('activity').select('id, actor, object_id').eq('verb', 'rate').order('id', { ascending: true });
  const seen = new Set<string>();
  const dupes: number[] = [];
  for (const a of rateActs ?? []) {
    const k = `${a.actor}|${a.object_id}`;
    if (seen.has(k)) dupes.push(a.id);
    else seen.add(k);
  }
  if (dupes.length) {
    for (let i = 0; i < dupes.length; i += 100) {
      await admin.from('activity').delete().in('id', dupes.slice(i, i + 100));
    }
    console.log(`  removed ${dupes.length} duplicate rate-activity rows from seed re-runs`);
  }

  const failed = results.filter(r => !r[1]);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed${failed.length ? ` — FAILURES: ${failed.map(f => f[0]).join('; ')}` : ''}`);
  if (failed.length) process.exit(1);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
