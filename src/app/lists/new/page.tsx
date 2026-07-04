import type { Metadata } from 'next';
import { ListBuilder } from '@/components/ListBuilder';

export const metadata: Metadata = { title: 'New list' };

export default function NewListPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-accent">New list</p>
      <h1 className="mb-6 font-display text-3xl sm:text-4xl">Build a ranking</h1>
      <ListBuilder />
    </div>
  );
}
