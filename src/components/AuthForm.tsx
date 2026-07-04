'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { USERNAME_RE } from '@/lib/validate';

export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const supabase = supabaseBrowser();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get('email') ?? '').trim();
    const password = String(fd.get('password') ?? '');

    try {
      if (mode === 'signup') {
        const username = String(fd.get('username') ?? '').trim().toLowerCase();
        const displayName = String(fd.get('display_name') ?? '').trim();
        if (!USERNAME_RE.test(username)) {
          setError('Usernames are 3–24 characters: lowercase letters, numbers, underscores.');
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username, display_name: displayName || username } },
        });
        if (error) {
          setError(error.message);
          return;
        }
        if (!data.session) {
          setNotice('Check your email to confirm the account, then sign in.');
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setError('That email and password don’t match an account.');
          return;
        }
      }
      router.push('/');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const input =
    'w-full rounded-chip border border-ink/20 bg-white/60 px-4 py-3 text-ink placeholder:text-ink2/60 focus:border-accent focus:outline-none';
  const label = 'mb-1.5 block font-mono text-[11px] uppercase tracking-[0.13em] text-ink2';

  return (
    <div className="mx-auto mt-[6vh] w-full max-w-md px-5 pb-10">
      <div className="mb-6 text-center">
        <span className="inline-flex items-center gap-2 font-display text-3xl text-paper">
          RUNOUT <span aria-hidden className="inline-block h-3 w-3 rounded-[2px] bg-accent" />
        </span>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.28em] text-muted">
          Ranked lists for record obsessives
        </p>
      </div>
      <div className="rounded-card bg-paper p-6 text-ink">
        <div className="mb-4 flex gap-1 border-b border-ink/15">
          <Link
            href="/login"
            aria-current={mode === 'login'}
            className={`px-4 py-2.5 font-mono text-xs uppercase tracking-wider ${
              mode === 'login' ? 'border-b-2 border-accent text-ink' : 'text-ink2'
            }`}
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            aria-current={mode === 'signup'}
            className={`px-4 py-2.5 font-mono text-xs uppercase tracking-wider ${
              mode === 'signup' ? 'border-b-2 border-accent text-ink' : 'text-ink2'
            }`}
          >
            Create account
          </Link>
        </div>

        {notice ? (
          <p className="py-4 text-sm">{notice}</p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div>
                  <label className={label} htmlFor="display_name">Display name</label>
                  <input className={input} id="display_name" name="display_name" maxLength={80} placeholder="Ana Grove" />
                </div>
                <div>
                  <label className={label} htmlFor="username">Username</label>
                  <input className={input} id="username" name="username" maxLength={24} placeholder="lowercase, letters & numbers" required />
                </div>
              </>
            )}
            <div>
              <label className={label} htmlFor="email">Email</label>
              <input className={input} id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <div>
              <label className={label} htmlFor="password">Password</label>
              <input
                className={input}
                id="password"
                name="password"
                type="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                minLength={6}
                required
              />
            </div>
            {error && <p className="font-mono text-xs text-[#A5341A]">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-chip bg-accent px-4 py-3 font-mono text-xs font-semibold uppercase tracking-wider text-press hover:bg-accent/90 disabled:opacity-60"
            >
              {mode === 'signup' ? 'Create account' : 'Sign in'}
            </button>
            <p className="font-mono text-[11px] leading-relaxed text-ink2">
              Auth is handled by Supabase — passwords never touch Runout’s own code.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
