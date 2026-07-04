import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ListBuilder, type BuilderEntry } from '@/components/ListBuilder';
import { currentUser, supabaseServer } from '@/lib/supabase/server';
import type { CatalogItem, Kind, List, ListStatus } from '@/lib/types';

export const metadata: Metadata = { title: 'Edit list' };

export default async function EditListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const user = await currentUser();
  const supabase = await supabaseServer();
  const { data: listRow } = await supabase.from('lists').select('*').eq('id', id).maybeSingle();
  const list = listRow as List | null;
  if (!list || list.owner !== user?.id) notFound();

  const { data: entryRows } = await supabase
    .from('list_entries')
    .select('position, blurb, catalog_items(*)')
    .eq('list_id', id)
    .order('position', { ascending: true });

  const entries: BuilderEntry[] = ((entryRows ?? []) as unknown as {
    position: number;
    blurb: string;
    catalog_items: CatalogItem | null;
  }[])
    .filter(e => e.catalog_items)
    .map(e => ({
      mbid: e.catalog_items!.mbid,
      title: e.catalog_items!.title,
      artist: e.catalog_items!.artist_name,
      year: e.catalog_items!.year,
      cover: e.catalog_items!.cover_url,
      blurb: e.blurb,
    }));

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-accent">Edit list</p>
      <h1 className="mb-6 font-display text-3xl sm:text-4xl">Rework the ranking</h1>
      <ListBuilder
        listId={list.id}
        initialTitle={list.title}
        initialDescription={list.description}
        initialKind={list.kind as Kind}
        initialStatus={list.status as ListStatus}
        initialEntries={entries}
      />
    </div>
  );
}
