# Ordko ROADMAP

Candidate backlog for the five-agent team. Seeded (cycle 1) verbatim from the
Product North Star priority list, then grown by Needle frictions and Crate
briefs. Ranked against one question: **does this help someone express their
taste, or feel seen for it?**

## Candidates (North Star seed)

1. **List-making is the hero act.** Creating a list of albums, songs, or
   artists should feel expressive and a little addictive — quick to start,
   satisfying to reorder, beautiful to publish. Friction here costs more than
   friction anywhere else.
2. **Profiles are canvases.** Avatars, background/banner images, pinned
   favorite albums and artists, taste summaries — people should *want* to share
   their profile. Schema-free interim move available: pick an avatar/banner from
   existing album art via the cover pipeline.
3. **Belonging through the graph — and taste that travels.** Following, being
   followed, seeing a like or comment land — surface these loops: counts, feeds,
   "X followed you," people with overlapping taste. Sharing is first-class:
   every list and profile gets a share/copy-link action, and sent links unfurl
   with rich OG cards showing covers and ranks.
4. **Speed is aesthetic.** Album artwork must load fast — placeholders,
   `next/image` sizing, cache headers, preconnects — always through the existing
   cover pipeline, never around it.
5. **Polish the connective tissue.** External links (Wikipedia/Discogs on items)
   precise and fluid; empty states that invite, not apologize; signed-out
   landing becomes an **animated welcome page** that sells the product in five
   seconds (multi-cycle epic — decompose into one-sitting slices: static
   redesign first, motion later; never a single task).

## Needs owner approval (schema-gated — never enters a cycle)

- Artist lists (`Kind` = `album | song` only today; adding `artist` needs schema).
- Image uploads for avatars/banners (needs storage buckets + policies).
- Notifications / "X followed you" persistence (needs tables).
- Activity feed persistence (needs tables).

## Someday: revenue

- (none yet — Crate/Foreman add one-line notes here when a credible taste-identity
  revenue pattern surfaces, e.g. Letterboxd Pro/Patron tiers.)

## Launch checklist (pre-launch, from prompt)

- Email confirmation + SMTP
- Demo-account retirement (`nadia/marcus/kei @demo.runout.local`)
- Password reset page
- Minimal admin/moderation panel
- Reserved usernames

## Next-cycle proposal (written at cycle-1 checkpoint; sources: Needle frictions,
## Crate brief, North Star, launch checklist — no new research)

1. **Inline rank-and-reorder in the list editor** (Crate #1; North Star 1 — the
   hero act still has the most friction; drag + click-number-to-jump).
2. **Create-CTA in context** (Needle friction: no "Start a list" from list/nav
   context for signed-in users; small, pairs with #1 as an editor-theme cycle).
3. **Discovery grid for empty states + signed-out landing static slice**
   (Crate #5; North Star 5; first slice of the welcome-page epic).
4. **Profile OG card** (lists unfurl now, profiles don't; reuse the cycle-1
   ImageResponse pattern with pins/banner covers).
5. **Repair verify-dod check #27** (parked: cache-aside assert is saturated at
   51 rows; rotate the query term or assert idempotent upsert instead).

## Cycle history

- Cycle 1 (2026-07-05): SHIPPED — shareable lists (copy-link + OG cards) +
  profile canvas (avatar + cover banner). main @ 4018086. Scorecard 8/7/7/8.
  1 return (OG mosaic), 1 parked verify-dod check (#27). See TEAM_LOG.

## Known limitation — song (recording) canonicity (2026-07-09, cycle 6)

Album search ranks canonically and robustly (release-count is a strong, stable
signal: "dark side of the moon"->Pink Floyd, "thriller"->Michael Jackson, verified
on prod). SONG search cannot reliably float the famous original above covers on a
COLD catalog, and this is a MusicBrainz data limitation, not a ranking bug:
  - MB gives every exact-title recording score=100 (no discrimination).
  - MB fragments a famous song across many recording MBIDs (per remaster/release),
    so no single canonical recording dominates by release-count in search results
    (diagnostic: Queen "Bohemian Rhapsody" recording shows releases=1 while covers
    show 4-5). Prod "bohemian rhapsody" landed on a cover.
Mitigations in place: dedup by (title+artist), orphan-recording demotion, noise
(karaoke/live/instrumental) demotion, MB-order prior, and the Ordko popularity
boost (published-list count) — the last SELF-CORRECTS as songs get added to lists.
Real fix if songs matter sooner: a Discogs-backed song-popularity pass (have/want),
or a curated canonical map. Deferred pending owner priority.
