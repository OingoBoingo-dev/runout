# Ordko TEAM LOG

Terse, append-only. One block per cycle: what shipped, scorecard, strikes, parks.

---

## Cycle 1 — calibration (2026-07-05)

**Theme:** Taste that travels + profiles as canvases.

### Needle — calibration scorecard (BASELINE, markup/reachability mode)
No live browser in this session → assessed from server-rendered HTML of the live
prod build (flows, structure, copy, empty states). Aesthetics is PROVISIONAL
(visual rendering not observable). Scope: home(/explore), signup, list, profile.

- **Usability 7/10** — signup form complete (display_name/username/email/password);
  chart loads; lists+profiles reachable; create-list correctly gated
  (`/lists/new` → 307 `/login?next=`). Couldn't walk authed create flow.
- **Ease of use 6/10** — front door = community chart, 1 click to a list/profile;
  BUT no copy/share on a list ("share my top 10" = hand-copy URL), no create CTA
  from within list/profile context.
- **Intuitiveness 7/10** — clear labels, genre chips, album/song toggle,
  like/comment/publish legible; username hint "lowercase, letters & numbers".
- **Aesthetics 7/10 (provisional)** — strong tokens in markup (font-display,
  bg-cobalt, paper, rounded-chip, mono uppercase micro-labels, consistent Cover);
  actual spacing/motion/render unverified.

Top-3 frictions → candidates:
1. **Shared list links don't travel** — no `og:image`/`twitter:card` on
   `/list/[id]`, no copy-link button. (North Star 3) — Crate #4.
2. **Profiles read generic** — monogram avatar (the `avatar_url` field is unused
   in render), no cover-derived identity/banner. (North Star 2) — Crate #3.
3. **Signed-out front door is the raw chart** — good meta description, but no
   designed welcome. (North Star 5) — ROADMAP epic, not this cycle.

Seen vs generic: discovery (chart + genre chips) feels a little *seen*; profiles
and shared links feel *generic* — a profile is a list index, a shared link a bare URL.

Note: Crate #2 (pinned top-4) already exists (profile.tsx) — dropped as duplicate.

### Task cards (2 tasks, disjoint manifests, both schema-free)

**Task A — Lathe-A (functionality): Shareable lists.** North Star 3.
- Goal: a list link travels — copy-link control + rich OG unfurl.
- Manifest (exclusive): NEW `src/components/CopyLinkButton.tsx`,
  NEW `src/app/list/[id]/opengraph-image.tsx`, EDIT `src/app/list/[id]/page.tsx`.
- Accept: `npx eslint src scripts` + `npm run build` pass; list page shows a
  Copy-link control (cobalt=interactive); `GET /list/<id>/opengraph-image` → 200
  image; `/list/<id>` head has `og:title` + `og:image`. Schema-free (reads
  existing list/entry cover_url; no cover fetching/guessing).

**Task B — Lathe-B (aesthetics/canvas): Cover-derived profile identity.** North Star 2.
- Goal: a profile feels like a canvas — render `avatar_url` image when set
  (fallback to existing monogram), add a soft blurred banner backdrop behind the
  header built from the user's existing pinned covers (fallback: covers from
  their newest published list; fallback: none). Purely presentational.
- Manifest (exclusive): EDIT `src/app/u/[username]/page.tsx`,
  NEW `src/components/ProfileBanner.tsx`.
- Accept: eslint + build pass; profile with pins shows a banner backdrop; header
  legible over it (contrast preserved); no schema/auth/action changes; reuses
  already-resolved `cover_url` only (no covers.ts bypass, no cover guessing).

Strikes: A[1] B[0]. Shared hotspots (globals.css/layout/lib) READ-ONLY for both.
- A strike 1 (verify): OG mosaic broken — exactly 2 covers stacked left, white
  void right (satori doesn't follow coverartarchive 307 redirects; flex-wrap
  collapse). Fixed by Lathe-A: inline cover bytes as data: URIs (4s timeout,
  skip-on-fail) + explicit 2x2 rows. Re-verified visually on 2 lists: full
  mosaic, zero void.

### Needle — re-test #2 (final, touched flows; markup + OG-render mode)
- Usability 8/10 (was 7) — share is now 1 click; OG endpoint 200 on all lists.
- Ease of use 7/10 (was 6) — copy-link in action row; create-CTA gap remains.
- Intuitiveness 7/10 (=) — "Copy link" self-explanatory, aria-live status.
- Aesthetics 8/10 (was 7, provisional) — OG card visually verified (paper/cobalt/
  yellow, 2x2 cover mosaic); profile banner markup verified (blur+paper gradients,
  fixed-height box, no layout shift). No axis below 6, none regressed. SHIP OK.

### Gates
- eslint clean; build clean; verify-dod **27/28 twice** — check #27 "search
  results cache-aside into catalog_items (51→51)" PARKED: pre-existing,
  data-dependent (Giegling results fully cached; check can never insert new
  rows again). Not caused by cycle diff (search/cache path untouched). Roadmap:
  fix the check to use a rotating query or assert upsert-idempotence instead.

### Shipped
- `main` @ 4018086 pushed (fa4241d..4018086) → Vercel auto-deploy → ordko.com
- Task A: copy-link + OG cards on /list/[id] (3 files, +286/-0 then fix +87/-37)
- Task B: avatar render + blurred cover banner on /u/[username] (2 files)
- Usage: agents spawned 3 (Crate, Lathe-A, Lathe-B; Needle run by Foreman in
  markup mode — no live browser available in session), tasks 2/2 shipped,
  1 return (A), 0 parked tasks, 1 parked verify-dod check.
