import { createClient } from "@supabase/supabase-js";

let client: ReturnType<typeof createClient> | null | undefined;

export function getSupabaseClient() {
  if (client !== undefined) return client;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  client =
    url && anonKey
      ? createClient(url, anonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
          },
        })
      : null;
  return client;
}
