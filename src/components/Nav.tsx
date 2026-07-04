import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import type { Profile } from '@/lib/types';

const monogram = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase() || '?';

export async function Nav() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let profile: Profile | null = null;
  if (user) {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    profile = data as Profile | null;
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-paper/10 bg-press/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link
          href="/"
          className="flex flex-none items-center gap-2 font-display text-lg tracking-wide text-paper"
        >
          RUNOUT
          <span aria-hidden className="inline-block h-2 w-2 rounded-[2px] bg-accent" />
        </Link>

        <form action="/search" className="min-w-0 flex-1 max-w-xl" role="search">
          <input
            type="search"
            name="q"
            placeholder="Search albums & songs"
            aria-label="Search albums and songs"
            autoComplete="off"
            className="h-10 w-full rounded-chip border border-paper/10 bg-paper/5 px-4 font-mono text-[13px] text-paper placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </form>

        <div className="ml-auto flex flex-none items-center gap-3">
          <Link
            href="/explore"
            className="hidden font-mono text-xs uppercase tracking-widest text-muted hover:text-paper sm:block"
          >
            Explore
          </Link>
          {user ? (
            <>
              <Link
                href="/lists/new"
                className="rounded-chip bg-accent px-3.5 py-2 font-mono text-xs font-semibold uppercase tracking-wider text-press hover:bg-accent/90"
              >
                + New list
              </Link>
              <Link
                href={profile ? `/u/${profile.username}` : '/settings'}
                aria-label="Your profile"
                className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-paper font-mono text-xs font-semibold text-ink"
              >
                {monogram(profile?.display_name || profile?.username || '?')}
              </Link>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-chip border border-paper/20 px-3.5 py-2 font-mono text-xs uppercase tracking-wider text-paper hover:border-paper"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
