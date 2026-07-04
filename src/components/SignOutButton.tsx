'use client';

import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await supabaseBrowser().auth.signOut();
        router.push('/explore');
        router.refresh();
      }}
      className="rounded-chip border border-paper/20 px-4 py-2.5 font-mono text-xs uppercase tracking-wider text-muted hover:border-paper hover:text-paper"
    >
      Sign out
    </button>
  );
}
