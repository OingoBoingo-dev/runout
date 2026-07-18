# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- **Lint (the gate):** `npx eslint src scripts` — bare `npm run lint` runs eslint with no paths; always pass `src scripts`.
- **Build:** `npm run build`. **Dev:** `npm run dev`.
- **Prod server:** `npm run start` blocks forever — run in background, and free the port first:
  `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"`
- **Regression gate (no other test suite exists):** `node --env-file=.env.local --import tsx scripts/verify-dod.ts http://localhost:3000` — must be 28/28. **It writes to the LIVE production DB** (throwaway `dodtester+*` user + a test list, cleaned up at the end). Confirm the local server responds first; if it aborts mid-run, delete the `dodtester+*` user and its "DoD Verification List" via the service-role client before re-running.
- **Seed / cover backfill:** `npm run seed`, `npm run backfill-covers`.

## Deploy — the one thing everyone gets wrong

**Pushing to GitHub does NOT deploy.** The Vercel project has no git integration. Ship with `npx vercel deploy --prod --yes` from this directory (CLI is already authed), then smoke-check `https://ordko.com` + `/explore` and revert `main` first if production is broken — root-cause later, never debug live prod.

## Environment (Windows)

- PowerShell 5.1: no `&&`, ASCII-only `.ps1`. Git Bash is available and preferred for compound commands.
- `jq` is not installed — parse JSON with `node -e`.
- Node lives at `C:\Program Files\nodejs` if a fresh shell lacks PATH.

## Architecture beyond the README

README.md covers auth/MB-queue/chart/feed/RLS basics. On top of that:

- **Design system ("Pressing-Plant Primaries"):** paper `#FAF6EC` ground, ink text; the four primaries are SEMANTIC — yellow = rank, cobalt = interactive, red = likes/Publish, green = confirmation. Max two primaries per component; glass on chrome only, and any fixed overlay inside `.glass` must portal to `<body>` (backdrop-filter traps fixed positioning). Every on-screen number goes through `src/lib/format.ts`.
- **Theme system:** `src/lib/themes.ts` schemes re-tint ONLY the neutral CSS vars (`--color-paper/card/ink/secondary/hairline`); primaries never change. Applied client-side (`VinylTheme.tsx`), mirrored to `localStorage['ordko-scheme']` + `profiles.theme_scheme`; visited profiles adopt the owner's scheme via `AdoptTheme.tsx` (restore on unmount). Locked schemes/frames gate SETTING, not seeing, and thresholds (25/50/75/100 contributions = published lists + ratings + comments) are re-checked server-side in `actions/profile.ts`.
- **Search:** `lib/mb.ts` fetches 100 candidates from MusicBrainz, `lib/search-rank.ts` (pure, no I/O) scores/dedups to 10. Album canonicity leans on MB's per-release-group `count`; song canonicity is a KNOWN LIMITATION (MB fragments famous recordings — see docs/ROADMAP.md). All MB traffic goes through the single p-queue in `mb.ts` (≤1 req/1100ms) — never add a second fetch path to musicbrainz.org.
- **Covers:** only via stored `catalog_items.cover_url` (resolved by `lib/covers.ts`) — never guess art URLs. CAA serves `-250/-500/-1200` size variants of the same URL; CAA 307-redirects to archive.org (slow, and satori/ImageResponse won't follow redirects — OG routes inline bytes as `data:` URIs and set CDN cache headers).
- **Ordko lists:** `lib/ordko-lists.ts` compiles community charts per `(kind, genre)` bucket — `score += 1000 − position` over PUBLISHED lists only. Any aggregation over lists/list_entries must filter `status='published'` explicitly (never rely on RLS alone); a draft/private leak into a public chart is a critical bug.
- **List visibility:** `status` is `draft | published | private`. RLS (`status='published' or owner=auth.uid()`) hides both non-published states from others; the service-role client sees everything (that is the "admin" mechanism — there is no admin UI yet). The publish trigger fires only on `→ published`, so private lists never stamp `published_at` or write activity.

## Schema is frozen

DDL cannot run from this machine (no CLI auth/DB password; the service key can't ALTER). Migrations are idempotent files in `supabase/migrations/` that the owner pastes into the Supabase dashboard SQL editor. Never assume a column exists until verified — server actions follow a tolerate-missing-column pattern (catch PGRST204/42703 → graceful sentinel).

## Working docs

`docs/TEAM_LOG.md` (append-only cycle log: what shipped, scorecards, strikes) and `docs/ROADMAP.md` (backlog, known limitations, owner-gated items). Read both before planning; append terse entries when shipping.
