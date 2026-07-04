import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-16">
      <div className="rounded-card border border-hairline bg-card p-10 text-center text-ink">
        <h1 className="font-display text-2xl">Needle skipped</h1>
        <p className="mt-2 text-secondary">
          That page doesn’t exist — or it’s a draft only its author can see.
        </p>
        <Link
          href="/explore"
          className="mt-5 inline-block rounded-chip bg-cobalt px-5 py-3 font-mono text-xs font-semibold uppercase tracking-wider text-paper"
        >
          Back to Explore
        </Link>
      </div>
    </div>
  );
}
