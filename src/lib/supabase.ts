import { createClient } from "@supabase/supabase-js";

let client: ReturnType<typeof createClient> | null | undefined;

export function getSupabaseClient() {
  if (client !== undefined) return client;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const publishableKey =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY;

  client =
    url && publishableKey
      ? createClient(url, publishableKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        })
      : null;
  return client;
}
