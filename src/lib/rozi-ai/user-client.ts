// ---------- A Supabase client that acts AS the signed-in person (SERVER ONLY) ----------
//
// Publishable key + the person's own access token: row-level security and the database functions decide what it can
// do. The person is identified only from the token (auth.getUser), never from anything in a request body.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export async function userClientFromToken(token: string | null, env: Record<string, string | undefined> = process.env): Promise<{ client: SupabaseClient; userId: string } | null> {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key) return null;
  const client = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return { client, userId: data.user.id };
}

/** The bearer token from an Authorization header, or null. */
export const bearerToken = (request: Request) => (request.headers.get("authorization") ?? "").match(/^Bearer\s+(\S+)$/i)?.[1] ?? null;
