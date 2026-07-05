-- 0003_identity_lists.sql
-- Owner-approved 2026-07-05 (chat): private lists, list types, broad genres;
-- profile theme / border / background. Idempotent — safe to re-run.
-- Apply via Supabase dashboard SQL editor (no CLI/db-password on this machine).

-- ============================ lists: 'private' status ============================
-- Existing RLS (lists_select: status='published' or owner=auth.uid()) already
-- hides non-published rows from others, so 'private' is visibility-safe with
-- no policy changes. Service role bypasses RLS (admin sees all — owner request).

do $$
declare c record;
begin
  -- Drop whichever check constraint governs lists.status (name may vary).
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public' and rel.relname = 'lists'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%status%'
  loop
    execute format('alter table public.lists drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.lists add constraint lists_status_check
  check (status in ('draft','published','private'));

-- ============================ lists: type + genres ============================

alter table public.lists add column if not exists list_type int
  check (list_type in (5,10,20,50,100,1000));
alter table public.lists add column if not exists genres text[] not null default '{}';

create index if not exists lists_genres_idx on public.lists using gin (genres);
create index if not exists lists_type_pub_idx on public.lists(list_type)
  where status = 'published';

-- ==================== profiles: theme / border / background ====================

alter table public.profiles add column if not exists theme_scheme text;
alter table public.profiles add column if not exists border_id text;
alter table public.profiles add column if not exists background_url text;

-- Storage bucket 'profile-media' is created programmatically with the service
-- role (public read; uploads go through an authenticated server action using
-- the service client, so no storage.objects policies are required).
