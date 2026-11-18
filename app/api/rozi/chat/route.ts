import { createClient } from "@supabase/supabase-js";
import { loadOwnTrainingData } from "@/lib/supabase-repository";
import { handleRoziChat, type RoziChatSession } from "@/lib/rozi-ai/handler";
import { createRateLimiter } from "@/lib/rozi-ai/rate-limit";
import { createCooldowns } from "@/lib/rozi-ai/fallback";
import { saveReply, startQuestion } from "@/lib/rozi-ai/history";
import { roziAiProviders } from "@/lib/rozi-ai/server";

// A question can take a couple of model calls (tools, then the answer), and may fall back to the next model in
// ROZI_AI_CHAIN; the whole question is kept within ~40 s.
export const maxDuration = 60;

/** Larger request bodies are refused before parsing (a question is ≤ 300 characters plus a little recent chat). */
const MAX_BODY_BYTES = 16_000;

const limiter = createRateLimiter();
/** Models resting after a failure, shared by requests on this server instance. */
const cooldowns = createCooldowns();

/**
 * Builds the person's session from their Supabase access token. The Supabase client acts AS the person (publishable
 * key + their token), so row-level security decides what it can read. No service-role key is used here.
 */
async function sessionFor(token: string): Promise<RoziChatSession | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  const client = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  const userId = data.user.id;
  return {
    userId,
    loadData: () => loadOwnTrainingData(client, userId),
    // Chat history and the daily limit, through the person's own sign-in (database functions check ownership).
    history: { start: (conversationId, message) => startQuestion(client, conversationId, message), saveReply: (conversationId, reply) => saveReply(client, conversationId, reply) },
  };
}

/**
 * Ask Rozi with AI. POST `{ message, history?, consent: true, conversationId? }` with `Authorization: Bearer <Supabase access token>`.
 * 200 `{ ok: true, text, cards, intent, model }`, or `{ ok: false, reason, message, fallback }` (then the app answers
 * on the device). Details: docs/ROZI_AI_INTEGRATION.md.
 */
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return Response.json({ ok: false, reason: "invalid", message: "That message is too long.", fallback: false }, { status: 413, headers });
  const raw = await request.text().catch(() => "");
  if (raw.length > MAX_BODY_BYTES) return Response.json({ ok: false, reason: "invalid", message: "That message is too long.", fallback: false }, { status: 413, headers });
  let body: unknown = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { body = null; }

  const token = (request.headers.get("authorization") ?? "").match(/^Bearer\s+(\S+)$/i)?.[1] ?? null;
  const result = await handleRoziChat({ token, body, signal: request.signal }, {
    session: sessionFor,
    providers: () => roziAiProviders(),
    cooldowns,
    limiter,
    log: (entry) => console.info(JSON.stringify(entry)),
  });
  return Response.json(result.body, { status: result.status, headers });
}
