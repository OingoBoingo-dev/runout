export type Kind = 'album' | 'song';
export type ListStatus = 'draft' | 'published' | 'private';
/** Allowed "Top N" sizes for public lists (0003 migration). */
export type ListType = 5 | 10 | 20 | 50 | 100 | 1000;

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  pinned_items: string[];
  created_at: string;
  /** Preset scheme id (see lib/themes) — null = stock paper. */
  theme_scheme: string | null;
  /** Profile-frame id (see lib/borders) — null = plain circle. */
  border_id: string | null;
  /** Uploaded profile background (profile-media bucket) — null = derived banner. */
  background_url: string | null;
}

export interface CatalogItem {
  mbid: string;
  kind: Kind;
  title: string;
  artist_name: string;
  artist_mbid: string | null;
  year: number | null;
  primary_type: string | null;
  cover_url: string | null;
  wikipedia_url: string | null;
  discogs_url: string | null;
  tags: string[];
  fetched_at: string;
}

export interface List {
  id: string;
  owner: string;
  title: string;
  description: string;
  kind: Kind;
  status: ListStatus;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  /** Top-N size — required when published, null on drafts/legacy rows. */
  list_type: ListType | null;
  /** Broad genre tags ('all time' is the catch-all) — empty on legacy rows. */
  genres: string[];
}

export interface ListEntry {
  list_id: string;
  position: number;
  item_mbid: string;
  blurb: string;
}

export interface Rating {
  user_id: string;
  item_mbid: string;
  value: number;
  review: string;
  created_at: string;
}

export interface Comment {
  id: string;
  list_id: string;
  author: string;
  body: string;
  created_at: string;
}

export interface Activity {
  id: number;
  actor: string;
  verb: 'publish' | 'rate' | 'follow' | 'comment';
  object_type: string;
  object_id: string;
  created_at: string;
}

export interface ChartRow {
  mbid: string;
  kind: Kind;
  title: string;
  artist_name: string;
  year: number | null;
  cover_url: string | null;
  tags: string[];
  score: number;
  list_count: number;
}

export interface Track {
  pos: number | string;
  title: string;
  len: number | null;
}

/**
 * Artist search/lookup result — display-only. Artists are NEVER written to
 * catalog_items (that table is album|song). Returned by search for a sectioned
 * global view and linked to /artist/{mbid}.
 */
export interface ArtistResult {
  mbid: string;
  name: string;
  disambiguation: string | null;
  /** MusicBrainz artist type: Group | Person | Orchestra | Choir | ... */
  type: string | null;
  area: string | null;
  /** MusicBrainz relevance score (0-100) — used only for ranking. */
  score: number;
}
