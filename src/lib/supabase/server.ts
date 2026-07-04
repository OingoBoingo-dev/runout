import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/** Request-scoped Supabase client (anon key + user cookies — RLS applies). */
export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // called from a Server Component — proxy refresh handles persistence
          }
        },
      },
    },
  );
}

export async function currentUser() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  return data.user;
}
