import Link from 'next/link';
import { TabLink } from '@/components/TabLink';
import { VinylTheme } from '@/components/VinylTheme';
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

const ICONS = {
  home: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 10.5L12 3l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
    </svg>
  ),
  explore: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" />
    </svg>
  ),
  plus: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  user: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M4.5 20c1.6-3.4 4.3-5 7.5-5s5.9 1.6 7.5 5" />
    </svg>
  ),
};

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
  const profileHref = profile ? (`/u/${profile.username}` as const) : ('/settings' as const);

  return (
    <>
      {/* Top bar — glass, neutral, fixed; content scrolls beneath it. */}
      <nav className="glass fixed inset-x-0 top-0 z-50 border-x-0 border-t-0 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link
            href="/"
            className="press flex flex-none items-center gap-2 font-display text-lg tracking-wide text-ink"
          >
            ORDKO
            <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-[3px] bg-yellow" />
          </Link>

          <form action="/search" className="min-w-0 max-w-xl flex-1" role="search">
            <input
              type="search"
              name="q"
              placeholder="Search albums & songs"
              aria-label="Search albums and songs"
              autoComplete="off"
              className="h-10 w-full rounded-chip border border-hairline bg-ink/5 px-4 font-mono text-[13px] text-ink placeholder:text-secondary focus:border-cobalt focus:outline-none"
            />
          </form>

          <div className="ml-auto hidden flex-none items-center gap-3 md:flex">
            <VinylTheme />
            <Link
              href="/explore"
              className="font-mono text-xs uppercase tracking-widest text-secondary hover:text-cobalt"
            >
              Explore
            </Link>
            <Link
              href="/ordko"
              className="font-mono text-xs uppercase tracking-widest text-secondary hover:text-cobalt"
            >
              Ordko
            </Link>
            {user ? (
              <>
                <Link
                  href="/lists/new"
                  className="press rounded-chip bg-yellow px-3.5 py-2 font-mono text-xs font-semibold uppercase tracking-wider text-ink hover:brightness-95"
                >
                  + New list
                </Link>
                <Link
                  href={profileHref}
                  aria-label="Your profile"
                  className="press flex h-9 w-9 flex-none items-center justify-center rounded-full bg-ink font-mono text-xs font-semibold text-paper"
                >
                  {monogram(profile?.display_name || profile?.username || '?')}
                </Link>
              </>
            ) : (
              <Link
                href="/login"
                className="press rounded-chip bg-cobalt px-3.5 py-2 font-mono text-xs font-semibold uppercase tracking-wider text-paper hover:brightness-110"
              >
                Sign in
              </Link>
            )}
          </div>

          {/* Mobile slim bar: theme record + (signed-out) sign-in stay reachable. */}
          <div className="ml-auto flex flex-none items-center gap-3 md:hidden">
            <VinylTheme />
            {!user && (
              <Link
                href="/login"
                className="press rounded-chip bg-cobalt px-3.5 py-2 font-mono text-xs font-semibold uppercase tracking-wider text-paper"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile bottom tab bar — floating glass; active icons cobalt. */}
      {user && (
        <nav
          aria-label="Primary"
          className="glass fixed bottom-[calc(12px+env(safe-area-inset-bottom))] left-1/2 z-50 flex h-[68px] w-[min(94vw,400px)] -translate-x-1/2 items-center justify-around gap-1 rounded-full px-2 shadow-[0_14px_40px_rgba(22,21,15,0.18)] md:hidden"
        >
          <TabLink href="/" label="Home">{ICONS.home}</TabLink>
          <TabLink href="/explore" label="Explore">{ICONS.explore}</TabLink>
          <Link
            href="/lists/new"
            aria-label="New list"
            className="press -mt-4 flex h-12 w-12 flex-none items-center justify-center rounded-full bg-yellow text-ink shadow-[0_6px_16px_rgba(22,21,15,0.18)]"
          >
            {ICONS.plus}
          </Link>
          <TabLink href={profileHref} label="Profile">{ICONS.user}</TabLink>
        </nav>
      )}
    </>
  );
}
