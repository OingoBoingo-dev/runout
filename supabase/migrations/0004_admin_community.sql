-- 0004_admin_community.sql
-- Owner-approved wave (2026-07-18 chat: "Go also get rolling on an admin panel"):
-- admin flag tied to @harper, artist follows (bookmark scope), submissions
-- queue (admin-verified user contributions), "added by" credit columns.
-- Idempotent — safe to re-run. Paste into Supabase dashboard SQL editor.

-- ============================ admin flag ============================
-- NOTE: profiles_select is public (using true), so is_admin is publicly
-- readable — acceptable: it only reveals the known operator account.

alter table public.profiles add column if not exists is_admin boolean not null default false;
update public.profiles set is_admin = true
  where id = '04a73963-c3ee-4e67-8855-120848557a38'; -- @harper

-- ======================= artist follows (bookmarks) =======================

create table if not exists public.artist_follows (
  follower uuid not null references public.profiles(id) on delete cascade,
  artist_mbid uuid not null,
  artist_name text not null default '',
  created_at timestamptz not null default now(),
  primary key (follower, artist_mbid)
);
alter table public.artist_follows enable row level security;
drop policy if exists artist_follows_select on public.artist_follows;
create policy artist_follows_select on public.artist_follows for select using (true);
drop policy if exists artist_follows_insert on public.artist_follows;
create policy artist_follows_insert on public.artist_follows
  for insert with check (follower = auth.uid());
drop policy if exists artist_follows_delete on public.artist_follows;
create policy artist_follows_delete on public.artist_follows
  for delete using (follower = auth.uid());

-- ========================= submissions queue =========================
-- Users propose missing albums/artists; admins verify before anything goes
-- live. Submitters read their own rows; admin operations use the service
-- role (no public read policy on purpose).

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('album','artist')),
  title text not null check (char_length(title) between 1 and 200),
  artist_name text not null default '' check (char_length(artist_name) <= 200),
  details text not null default '' check (char_length(details) <= 1000),
  submitted_by uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.submissions enable row level security;
drop policy if exists submissions_select_own on public.submissions;
create policy submissions_select_own on public.submissions
  for select using (submitted_by = auth.uid());
drop policy if exists submissions_insert on public.submissions;
create policy submissions_insert on public.submissions
  for insert with check (submitted_by = auth.uid());

create index if not exists submissions_status_idx on public.submissions(status, created_at desc);

-- ===================== "added by" credit (approved submissions) =====================

alter table public.catalog_items add column if not exists submitted_by uuid references public.profiles(id);
alter table public.catalog_items add column if not exists submitted_at timestamptz;
