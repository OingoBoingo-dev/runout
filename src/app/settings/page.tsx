import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SettingsForm } from '@/components/SettingsForm';
import { supabaseServer } from '@/lib/supabase/server';
import type { Profile } from '@/lib/types';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  const profile = data as Profile | null;
  if (!profile) redirect('/login');

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8">
      <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-accent">Settings</p>
      <h1 className="mb-6 font-display text-3xl">Profile</h1>
      <SettingsForm
        username={profile.username}
        displayName={profile.display_name}
        bio={profile.bio}
      />
    </div>
  );
}
