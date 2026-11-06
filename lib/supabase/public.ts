import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let publicClient: SupabaseClient | null = null;

/**
 * Cookie-free anon client for public storefront reads. It never carries a user
 * session, so row-level security returns exactly what an anonymous visitor may
 * see, and results are safe to share across visitors via the data cache.
 */
export function createPublicSupabaseClient(): SupabaseClient {
  if (publicClient) return publicClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  publicClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return publicClient;
}
