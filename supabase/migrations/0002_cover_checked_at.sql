-- Pre-approved additive migration (visual system pass): remember when cover
-- resolution last ran for an item so misses aren't re-fetched on every touch.
alter table public.catalog_items add column if not exists cover_checked_at timestamptz;
