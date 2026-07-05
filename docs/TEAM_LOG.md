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

### Ship addendum (deploy mechanism)
- "Auto-deploys from main" premise is FALSE: the Vercel project has NO Git
  integration (no deployments/check-runs/statuses on GitHub; `vercel whoami`
  nudges to connect a repo). All prior deploys were owner CLI deploys.
- Shipped via `npx vercel deploy --prod --yes` → dpl runout-nblf2x0zy READY.
- Prod smoke: home 307, explore/list/profile 200; Copy link + og:image live;
  OG PNG 200 (rendered 2-cover fallback layout on prod — some cover fetches
  timed out on Vercel runtime; no void, graceful). Banner markup live.
- Future cycles: ship step = merge to main, push, then CLI prod deploy.

---

## Cycle 2 (2026-07-05)

**Theme:** Editor delight + taste that travels, part 2.
Crate: not spawned (ROADMAP holds 5 candidates; cost rule). Sources: cycle-1
proposal bullets 1 & 4.

### Task cards (2 tasks, disjoint manifests, schema-free)

**Task C — Lathe-B (interaction/motion): Reorder that feels good everywhere.**
North Star 1 (hero act). ROADMAP #1.
- Today: grip drag is desktop-only (HTML5 DnD ignores touch), no position-jump,
  no motion feedback on reorder.
- Goal: (1) tap position number → type target → Enter → row jumps there
  (mobile + long-list killer feature); (2) reorder works on touch (pointer-based
  drag or equivalent); (3) subtle settle animation on reorder (FLIP/transform,
  respects prefers-reduced-motion). Keep arrows + existing drag semantics.
- Manifest (exclusive): EDIT `src/components/ListBuilder.tsx` only.
- Accept: eslint+build pass; position-jump works by keyboard alone; touch path
  stated + implemented; no new deps; cobalt=interactive only; no action/schema
  changes (reorder stays client-side pre-save).

**Task D — Lathe-A (route/data): Profile OG card.** North Star 2+3. ROADMAP #4.
- Goal: profile links unfurl like list links do — reuse the cycle-1
  ImageResponse pattern (inline cover bytes as data: URIs, explicit rows).
- Manifest (exclusive): NEW `src/app/u/[username]/opengraph-image.tsx`,
  EDIT `src/app/u/[username]/page.tsx` (add generateMetadata only — do not
  touch the page body/queries).
- Card content: display name, @username, list/rating/follower counts, mosaic
  from pinned covers (fallback: newest published list covers; fallback:
  branded no-cover panel). Draft lists never leak.
- Accept: eslint+build pass; GET /u/nadia/opengraph-image → 200 PNG, visually
  verified (no voids); /u/nadia head has og:title+og:image; page body untouched.

Strikes: C[0] D[0]. ListBuilder/u-page exclusive to their writers; all lib/*,
globals.css, layout.tsx READ-ONLY. Ship = merge→push→CLI prod deploy (cycle-1
addendum).

### Cycle-2 verify + scorecard (Needle; markup + OG-render mode)
- Usability 8/10 — profile OG 200 + meta complete; editor keyboard path
  (position-button → numeric input → Enter) fully specified & lint/type-clean;
  auth gate intact. Editor NOT hand-walked (auth + no browser in session) —
  compensated by Lathe-B's index-math walkthrough (verified sound: splice
  remove-then-insert is direction-agnostic) + verify-dod list flows.
- Ease of use 7/10 — position jump collapses N taps → 1 type on long lists;
  touch drag unblocks 375px reordering entirely.
- Intuitiveness 7/10 — tappable rank number is a mild discoverability bet;
  aria-labels strong ("Position N of M — change position for <title>").
- Aesthetics 8/10 — profile OG card visually verified (wordmark, yellow counts
  pill, edge-to-edge mosaic, zero voids; runtime cover-fetch variance handled
  gracefully). FLIP settle unverified visually; reduced-motion respected.
- No axis <6, none regressed vs cycle 1. SHIP OK.
- Known limitation (logged, not blocking): no viewport auto-scroll during
  touch-drag on very long lists → ROADMAP candidate.

### Gates
- eslint clean; build clean (both OG routes registered); verify-dod 27/28 —
  #27 same pre-existing saturated-cache defect (75→75), stays parked.

### Shipped
- Task C: editor reorder — position jump, pointer-events drag (touch+mouse),
  FLIP settle motion. 1 file, +237/-55. First-pass accept.
- Task D: profile OG card + generateMetadata. 2 files, +315. First-pass accept.
- Strikes: C[0] D[0]. Usage: 0 new spawns (both writers resumed), Crate skipped.

### Next-cycle proposal (from written material only)
1. Signed-out landing static slice (welcome epic, slice 1) — Crate #5 grid as
   hero; the front door still sells nothing (Needle, both cycles).
2. Create-CTA in context for signed-in users (cycle-1 friction, still open).
3. Inline reorder polish: viewport auto-scroll during touch drag (Lathe-B's
   flagged limitation).
4. Repair verify-dod #27 (rotate query term or assert idempotent upsert).
5. Launch checklist opener: password reset page (schema-free, Supabase Auth
   built-in flow).

### Cycle-2 ship addendum
- Deployed runout-ovgups85a READY; prod smoke green (home 307, explore/list/
  profile 200, og:title live, profile OG 200).
- DEGRADATION (not a break): on Vercel runtime the profile OG rendered the
  "No covers yet" fallback — all 4 cover fetches exceeded the 4s budget
  (coverartarchive 307→archive.org cold latency). Locally 2-4 covers land.
  Same weakness on list OG (cycle 1 showed 2/4 on prod). Valid branded PNG
  either way; page + metadata unaffected. → PROMOTED to next-cycle bullet #1:
  OG cover-fetch reliability (longer budget via streamed parallel fetch,
  and/or serve covers from own-domain cached proxy per covers pipeline, or
  precompute data-URIs). Frozen-schema note: any caching table needs owner
  approval; header-cache/edge options don't.

---

## Cycle 3 (2026-07-05) — owner expansion run, wave 1 of 3

**Owner batch:** scroll-indicator scoping; theme overhaul (8 schemes + 4 locked
ambient, adoption on visited profiles); designed profile borders w/ unlock
gating; photo/background changing (real uploads approved); homepage split +
public/private + Top-N + genres; Ordko aggregate lists.
**Owner decisions:** schema YES (all); private = new status (admin sees all via
service role); real uploads now; trending = engagement proxy (no view table).

**Theme:** Foundations — schema, uploads, theme system.

- Foreman: migration 0003 written (private status w/ dynamic constraint drop,
  list_type, genres, theme/border/background cols, gin+partial indexes);
  types.ts updated; storage bucket `profile-media` created LIVE via service
  role (public read, 4MB, image mimes). DDL blocked locally (no CLI auth/db
  password) → owner asked to paste 0003 in dashboard SQL editor.
- Crate spawned (parallel): border-frame research brief (videogame nameplates →
  12 original SVG concepts, 4 animated; feeds cycle-4 Lathe-B task).

**Task G — Lathe-A: media uploads.** DONE first pass @ 906142c.
- actions/media.ts (service client = storage only, lazily built, never exported;
  profile row writes via user's RLS client; orphan-cleanup on failed update;
  pending-migration guard for background_url), MediaUpload.tsx, settings wiring,
  profile render (chosen background replaces derived banner, light blur).
- eslint/build clean. Runtime e2e deferred to cycle verify (needs auth session
  + migration).

**Task F — Lathe-B: theme schemes + VUScroll scoping.** IN BUILD.
- VUScroll → /list/* only. VinylTheme wheel → 12-scheme grid (8 unlocked incl.
  2 dark, 4 locked ambient @ 25/50/75/100 contributions), lib/themes.ts,
  AdoptTheme on visited profiles, saveThemeScheme/getThemeAccess actions,
  ambient layer + keyframes in globals.css (B owns hotspot this cycle).

Strikes: G[0] F[0]. Sequenced file ownership: u/[username]/page.tsx A→B.

**Task F — Lathe-B: DONE first pass @ 8fbff5e.** 12 schemes (8 free incl. 2
dark, 4 locked ambient 25/50/75/100), WCAG-verified (>=13.9:1 ink/paper all,
secondary fixed during self-review), browser-verified picker + VU scoping,
AdoptTheme restore-on-unmount + profile->profile nav, server-side unlock
re-check in saveThemeScheme.

### Cycle-3 verify (Needle, markup + DB-roundtrip mode)
- Migration 0003 applied by owner; columns live (probe verified). Bucket
  round-trip: upload -> public 200 -> cleanup OK.
- e2e via admin client on demo profile nadia: theme_scheme='after-hours' ships
  in /u/nadia payload (adoption live); background_url (her pinned Aphex cover)
  renders in banner @ blur-[3px]. LEFT SET on nadia as a live feature demo.
- VU bars: 0 on /explore, present on /list/<id>. /settings 307->login.
  Smoke 5/5 200s. eslint/build clean. verify-dod 27/28 (#27 parked, known).
- Scorecard: usability 8 / ease 7 / intuitiveness 7 / aesthetics 8. No axis <6,
  none regressed. SHIP.

Strikes: G[0] F[0]. Usage: 2 resumes + 1 Crate spawn (border brief delivered,
feeds cycle 4).
