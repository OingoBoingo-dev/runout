'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { updateProfile } from '@/app/actions/profile';

export function SettingsForm({
  username,
  displayName,
  bio,
}: {
  username: string;
  displayName: string;
  bio: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(displayName);
  const [about, setAbout] = useState(bio);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const label = 'mb-1.5 block font-mono text-[11px] uppercase tracking-[0.13em] text-ink2';
  const input =
    'w-full rounded-chip border border-ink/20 bg-white/60 px-4 py-3 text-ink placeholder:text-ink2/60 focus:border-accent focus:outline-none';

  return (
    <form
      className="rounded-card bg-paper p-6 text-ink"
      onSubmit={e => {
        e.preventDefault();
        setMsg(null);
        setError(null);
        startTransition(async () => {
          const res = await updateProfile({ displayName: name, bio: about });
          if ('error' in res) setError(res.error);
          else {
            setMsg('Profile saved.');
            router.refresh();
          }
        });
      }}
    >
      <div className="space-y-4">
        <div>
          <span className={label}>Username</span>
          <p className="font-mono text-sm">@{username}</p>
          <p className="mt-1 font-mono text-[11px] text-ink2">Usernames are permanent in this version.</p>
        </div>
        <div>
          <label className={label} htmlFor="s-name">Display name</label>
          <input id="s-name" className={input} value={name} maxLength={80} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label className={label} htmlFor="s-bio">Bio</label>
          <textarea
            id="s-bio"
            className={`${input} min-h-[80px]`}
            value={about}
            maxLength={280}
            onChange={e => setAbout(e.target.value)}
          />
          <p className="mt-1 text-right font-mono text-[10px] tabular-nums text-ink2">{about.length}/280</p>
        </div>
        {error && <p className="font-mono text-xs text-[#A5341A]">{error}</p>}
        {msg && <p className="font-mono text-xs text-ink2">{msg}</p>}
        <button
          type="submit"
          disabled={pending}
          className="rounded-chip bg-accent px-5 py-3 font-mono text-xs font-semibold uppercase tracking-wider text-press disabled:opacity-60"
        >
          Save profile
        </button>
      </div>
    </form>
  );
}
