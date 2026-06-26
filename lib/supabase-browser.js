import { createBrowserClient } from '@supabase/ssr';

// Browser client — used in Client Components.
// Uses the public anon key; RLS policies enforce what each user can read.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
