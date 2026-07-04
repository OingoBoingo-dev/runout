# Runout

Production build of **Runout** — a social platform for ranked album and song lists
(top 1–999), community charts, ratings, comments, follows. The approved interactive
preview lives at [ordko.com](https://ordko.com).

**Stack:** Next.js 16 (App Router) + TypeScript + Tailwind v4 · Supabase (Postgres +
RLS + Auth) · deployed on Vercel.

## Setup

1. **Supabase project** — create one at supabase.com, then:
   - Apply the migration: paste `supabase/migrations/0001_init.sql` into the SQL
     Editor and run it (idempotent — safe to re-run), or use
     `supabase db push` with the CLI.
   - Recommended for demos: Authentication → Sign In / Up → disable
     "Confirm email" so signup grants a session immediately. The UI handles the
     confirmation flow either way.
2. **Env** — copy `.env.example` to `.env.local` and fill in the Supabase URL,
   publishable (anon) key, secret (service-role) key, and an `MB_CONTACT`
   email/URL for the MusicBrainz User-Agent. `DISCOGS_TOKEN` is optional and
   enables `/api/discogs/enrich/[mbid]`.
3. **Install & run**
   ```bash
   npm install
   npm run dev
   ```
4. **Seed** (after migrations):
   ```bash
   npm run seed
   ```
   Creates demo users `nadia` / `marcus` / `kei` (`*@demo.runout.local`,
   passwords `runout-demo-1/2/3`), pulls ~30 real releases through MusicBrainz
   (throttled), publishes 5 lists and cross-wires follows/ratings/comments/likes.

## Deploy (Vercel)

Import the repo in Vercel, set the same env vars (`NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `MB_CONTACT`,
optional `DISCOGS_TOKEN`), deploy. No other configuration is required.

## Architecture notes

- **Auth** is Supabase-only. A Postgres trigger creates the `profiles` row on
  signup (username from metadata, `^[a-z0-9_]{3,24}$` enforced). `src/proxy.ts`
  (Next 16's middleware) refreshes sessions and guards `/lists/*` and `/settings`.
- **MusicBrainz** is only ever called server-side (`src/lib/mb.ts`) with a real
  User-Agent, serialized through a p-queue at ≤1 request/1100ms. Every successful
  lookup upserts into `catalog_items` (cache-aside) — the catalog grows as the
  community searches. Saturation returns 503 + Retry-After, never a limit breach.
  *Caveat:* on serverless the queue is per-instance; Next's data cache plus
  cache-aside keeps real MB traffic near zero once warm.
- **Chart** is the SQL view `chart_view`: `score = Σ (1000 − position)` over
  published lists, tie-broken by list count then title. If it ever slows down,
  convert to a materialized view refreshed every ~10 minutes.
- **Feed** is fan-out-on-read over the `activity` table, which is written only
  by security-definer triggers on publish/rate/follow/comment.
- **RLS** is enabled on every table; drafts are invisible to non-owners at the
  database level. All mutations go through zod-validated server actions using
  the caller's own session (the service key is used only by the seed script and
  the catalog cache writer).
- **Numbers**: `src/lib/format.ts` — zero-padded positions, `toLocaleString`
  separators, one-decimal ratings with `—` for unrated, pluralized counts,
  years only when a plausible 4-digit year exists.
