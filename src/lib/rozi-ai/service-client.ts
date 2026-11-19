// ---------- Rozi AI: the server-only database client for saving AI replies ----------
//
// SERVER ONLY. Uses SUPABASE_SERVICE_ROLE_KEY (never NEXT_PUBLIC_), which bypasses row-level security, so it is used
// for exactly one thing: calling rozi_save_ai_reply after /api/rozi/chat has checked the person's sign-in. That
// database function is callable only by the service role and still checks the conversation belongs to the person.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null | undefined;

/** The service-role client, or null when the key isn't configured (then AI replies just aren't saved to history). */
export function roziServiceClient(env: Record<string, string | undefined> = process.env): SupabaseClient | null {
  if (typeof window !== "undefined") return null;
  if (cached !== undefined && env === process.env) return cached;
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const client = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }) : null;
  if (env === process.env) cached = client;
  return client;
}
