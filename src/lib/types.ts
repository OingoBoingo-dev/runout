export type Kind = 'album' | 'song';
export type ListStatus = 'draft' | 'published';

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  pinned_items: string[];
  created_at: string;
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
