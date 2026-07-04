-- Runout — initial schema, RLS, triggers, chart view.
-- Idempotent: safe to re-run against an existing project.

-- ============================== tables ==============================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null default '',
  bio text not null default '' check (char_length(bio) <= 280),
  avatar_url text,
  pinned_items uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.catalog_items (
  mbid uuid primary key,
  kind text not null check (kind in ('album','song')),
  title text not null,
  artist_name text not null default '',
  artist_mbid uuid,
  year int,
  primary_type text,
  cover_url text,
  wikipedia_url text,
  discogs_url text,
  tags text[] not null default '{}',
  fetched_at timestamptz not null default now()
);

create table if not exists public.lists (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 140),
  description text not null default '' check (char_length(description) <= 1000),
  kind text not null check (kind in ('album','song')),
  status text not null default 'draft' check (status in ('draft','published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);

create table if not exists public.list_entries (
  list_id uuid not null references public.lists(id) on delete cascade,
  position int not null check (position between 1 and 999),
  item_mbid uuid not null references public.catalog_items(mbid),
  blurb text not null default '' check (char_length(blurb) <= 280),
  primary key (list_id, position),
  unique (list_id, item_mbid)
);

create table if not exists public.ratings (
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_mbid uuid not null references public.catalog_items(mbid),
  value numeric(2,1) not null check (value between 0.5 and 5),
  review text not null default '' check (char_length(review) <= 1000),
  created_at timestamptz not null default now(),
  primary key (user_id, item_mbid)
);

create table if not exists public.follows (
  follower uuid not null references public.profiles(id) on delete cascade,
  followee uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower, followee),
  check (follower <> followee)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists(id) on delete cascade,
  author uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create table if not exists public.likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('list','comment')),
  target_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);

create table if not exists public.activity (
  id bigint generated always as identity primary key,
  actor uuid not null references public.profiles(id) on delete cascade,
  verb text not null check (verb in ('publish','rate','follow','comment')),
  object_type text not null,
  object_id uuid not null,
  created_at timestamptz not null default now()
);

-- ============================== indexes ==============================

create index if not exists list_entries_item_idx on public.list_entries(item_mbid);
create index if not exists lists_owner_status_idx on public.lists(owner, status);
create index if not exists activity_actor_created_idx on public.activity(actor, created_at desc);
create index if not exists ratings_item_idx on public.ratings(item_mbid);
create index if not exists comments_list_created_idx on public.comments(list_id, created_at);

-- ============================== triggers ==============================

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists lists_updated_at on public.lists;
create trigger lists_updated_at before update on public.lists
for each row execute function public.set_updated_at();

-- Profile auto-creation on signup (username from signup metadata).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare uname text;
begin
  uname := lower(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
  uname := regexp_replace(uname, '[^a-z0-9_]', '', 'g');
  if uname !~ '^[a-z0-9_]{3,24}$' then
    uname := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;
  if exists (select 1 from public.profiles where username = uname) then
    uname := substr(uname, 1, 15) || '_' || substr(replace(new.id::text, '-', ''), 1, 6);
  end if;
  insert into public.profiles (id, username, display_name)
  values (new.id, uname, coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), uname));
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Activity is written only by these triggers (and the service role) — never by clients.
create or replace function public.log_publish() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT' and new.status = 'published')
     or (tg_op = 'UPDATE' and new.status = 'published' and old.status <> 'published') then
    new.published_at = now();
    insert into public.activity (actor, verb, object_type, object_id)
    values (new.owner, 'publish', 'list', new.id);
  end if;
  return new;
end $$;

drop trigger if exists lists_publish on public.lists;
create trigger lists_publish before insert or update on public.lists
for each row execute function public.log_publish();

create or replace function public.log_rating() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.activity (actor, verb, object_type, object_id)
  values (new.user_id, 'rate', 'item', new.item_mbid);
  return new;
end $$;

drop trigger if exists ratings_activity on public.ratings;
create trigger ratings_activity after insert or update of value on public.ratings
for each row execute function public.log_rating();

create or replace function public.log_follow() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.activity (actor, verb, object_type, object_id)
  values (new.follower, 'follow', 'profile', new.followee);
  return new;
end $$;

drop trigger if exists follows_activity on public.follows;
create trigger follows_activity after insert on public.follows
for each row execute function public.log_follow();

create or replace function public.log_comment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.activity (actor, verb, object_type, object_id)
  values (new.author, 'comment', 'comment', new.id);
  return new;
end $$;

drop trigger if exists comments_activity on public.comments;
create trigger comments_activity after insert on public.comments
for each row execute function public.log_comment();

-- ============================== chart view ==============================
-- score = Σ (1000 − position) over entries of published lists of matching kind.
-- security_invoker: reads run under the caller's RLS (published-only anyway).

drop view if exists public.chart_view;
create view public.chart_view with (security_invoker = on) as
select
  ci.mbid,
  ci.kind,
  ci.title,
  ci.artist_name,
  ci.year,
  ci.cover_url,
  ci.tags,
  sum(1000 - le.position)::bigint as score,
  count(distinct l.id)::int as list_count
from public.list_entries le
join public.lists l on l.id = le.list_id and l.status = 'published'
join public.catalog_items ci on ci.mbid = le.item_mbid
group by ci.mbid;

-- If chart queries slow down at scale, convert to a materialized view refreshed
-- every ~10 minutes (see README). Shipping the plain view per spec.

-- ============================== RLS ==============================

alter table public.profiles      enable row level security;
alter table public.catalog_items enable row level security;
alter table public.lists         enable row level security;
alter table public.list_entries  enable row level security;
alter table public.ratings       enable row level security;
alter table public.follows       enable row level security;
alter table public.comments      enable row level security;
alter table public.likes         enable row level security;
alter table public.activity      enable row level security;

-- profiles: readable by all; owner may update
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (true);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);

-- catalog_items: readable by all; writes only via service role (no client policy)
drop policy if exists catalog_select on public.catalog_items;
create policy catalog_select on public.catalog_items for select using (true);

-- lists: published readable by all; drafts only by owner; owner writes
drop policy if exists lists_select on public.lists;
create policy lists_select on public.lists for select
  using (status = 'published' or owner = auth.uid());
drop policy if exists lists_insert on public.lists;
create policy lists_insert on public.lists for insert
  with check (owner = auth.uid());
drop policy if exists lists_update on public.lists;
create policy lists_update on public.lists for update
  using (owner = auth.uid()) with check (owner = auth.uid());
drop policy if exists lists_delete on public.lists;
create policy lists_delete on public.lists for delete
  using (owner = auth.uid());

-- list_entries: inherit list visibility; owner writes
drop policy if exists entries_select on public.list_entries;
create policy entries_select on public.list_entries for select
  using (exists (select 1 from public.lists l
                 where l.id = list_id and (l.status = 'published' or l.owner = auth.uid())));
drop policy if exists entries_insert on public.list_entries;
create policy entries_insert on public.list_entries for insert
  with check (exists (select 1 from public.lists l
                      where l.id = list_id and l.owner = auth.uid()));
drop policy if exists entries_update on public.list_entries;
create policy entries_update on public.list_entries for update
  using (exists (select 1 from public.lists l
                 where l.id = list_id and l.owner = auth.uid()));
drop policy if exists entries_delete on public.list_entries;
create policy entries_delete on public.list_entries for delete
  using (exists (select 1 from public.lists l
                 where l.id = list_id and l.owner = auth.uid()));

-- ratings / follows / comments / likes: readable by all; own rows writable
drop policy if exists ratings_select on public.ratings;
create policy ratings_select on public.ratings for select using (true);
drop policy if exists ratings_insert on public.ratings;
create policy ratings_insert on public.ratings for insert with check (user_id = auth.uid());
drop policy if exists ratings_update on public.ratings;
create policy ratings_update on public.ratings for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists ratings_delete on public.ratings;
create policy ratings_delete on public.ratings for delete using (user_id = auth.uid());

drop policy if exists follows_select on public.follows;
create policy follows_select on public.follows for select using (true);
drop policy if exists follows_insert on public.follows;
create policy follows_insert on public.follows for insert with check (follower = auth.uid());
drop policy if exists follows_delete on public.follows;
create policy follows_delete on public.follows for delete using (follower = auth.uid());

drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments for select using (true);
drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments for insert with check (author = auth.uid());
drop policy if exists comments_delete on public.comments;
create policy comments_delete on public.comments for delete using (author = auth.uid());

drop policy if exists likes_select on public.likes;
create policy likes_select on public.likes for select using (true);
drop policy if exists likes_insert on public.likes;
create policy likes_insert on public.likes for insert with check (user_id = auth.uid());
drop policy if exists likes_delete on public.likes;
create policy likes_delete on public.likes for delete using (user_id = auth.uid());

-- activity: readable by all; written only by security-definer triggers / service role
drop policy if exists activity_select on public.activity;
create policy activity_select on public.activity for select using (true);
