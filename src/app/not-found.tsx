import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-16">
      <div className="rounded-card bg-paper p-10 text-center text-ink">
        <h1 className="font-display text-2xl">Needle skipped</h1>
        <p className="mt-2 text-ink2">
          That page doesn’t exist — or it’s a draft only its author can see.
        </p>
        <Link
          href="/explore"
          className="mt-5 inline-block rounded-chip bg-accent px-5 py-3 font-mono text-xs font-semibold uppercase tracking-wider text-press"
        >
          Back to Explore
        </Link>
      </div>
    </div>
  );
}
