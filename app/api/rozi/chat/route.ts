import { loadOwnTrainingData } from "@/lib/supabase-repository";
import { actionsEnabled, proposeAction } from "@/lib/rozi-ai/actions/action-service";
import { goalProgressOutcome, goalsEnabled, loadLiveGoal, proposeGoal } from "@/lib/rozi-ai/planning/goal-service";
import { listMemories, memoryEnabled } from "@/lib/rozi-ai/memory/memory-service";
import { bearerToken, userClientFromToken } from "@/lib/rozi-ai/user-client";
import { handleRoziChat, type RoziChatSession } from "@/lib/rozi-ai/handler";
import { createRateLimiter, DEGRADED_RATE_LIMITS } from "@/lib/rozi-ai/rate-limit";
import { createCooldowns } from "@/lib/rozi-ai/fallback";
import { loadHistoryLines, saveAiReply, startQuestion } from "@/lib/rozi-ai/history";
import { roziServiceClient } from "@/lib/rozi-ai/service-client";
import { roziAiProviders } from "@/lib/rozi-ai/server";

// A question can take a couple of model calls (tools, then the answer), and may fall back to the next model in
// ROZI_AI_CHAIN; the whole question is kept within ~40 s.
export const maxDuration = 60;

/** Larger request bodies are refused before parsing (a question is ≤ 300 characters plus a little recent chat). */
const MAX_BODY_BYTES = 16_000;

/** Used only when the database limit is unavailable: degraded, per-instance protection (see rate-limit.ts). */
const limiter = createRateLimiter(DEGRADED_RATE_LIMITS);
/** Models resting after a failure, shared by requests on this server instance. */
const cooldowns = createCooldowns();

/**
 * Builds the person's session from their Supabase access token. The Supabase client acts AS the person (publishable
 * key + their token), so row-level security decides what it can read. No service-role key is used here.
 */
async function sessionFor(token: string): Promise<RoziChatSession | null> {
  const signedIn = await userClientFromToken(token);
  if (!signedIn) return null;
  const { client, userId } = signedIn;
  const service = roziServiceClient();
  return {
    // Level 3: Rozi may PROPOSE changes (recorded for the person to approve on a card) — only with ROZI_ACTIONS=on.
    ...(actionsEnabled() && service ? { actions: { propose: (ctx, args, conversationId) => proposeAction({ service, userId, ctx, conversationId }, args) } } : {}),
    // Level 4: Rozi may PROPOSE a goal with a weekly plan (the person approves it once) — only with ROZI_GOALS=on.
    ...(goalsEnabled() && service ? { goals: {
      propose: (ctx, args, conversationId) => proposeGoal({ service, userId, ctx, conversationId }, args),
      // Read through the person's own sign-in (owner-checked function), never the service role.
      progress: async (ctx) => goalProgressOutcome(await loadLiveGoal(client, ctx.today).catch(() => null), ctx),
    } } : {}),
    // R10: the person's saved notes, read through their own sign-in (owner-checked function) — only with ROZI_MEMORY=on.
    ...(memoryEnabled() ? { memory: { load: () => listMemories(client) } } : {}),
    userId,
    loadData: () => loadOwnTrainingData(client, userId),
    // Chat history and the daily limit, through the person's own sign-in (database functions check ownership).
    history: {
      // Earlier turns from the person's own saved conversation (owner-checked), never from the request body.
      load: (conversationId) => loadHistoryLines(client, conversationId),
      start: (conversationId, message) => startQuestion(client, conversationId, message),
      // AI replies are saved by the server only (service role), after the sign-in above was checked.
      saveAiReply: async (conversationId, reply) => {
        const service = roziServiceClient();
        return service ? saveAiReply(service, userId, conversationId, reply) : false;
      },
    },
  };
}

/**
 * Ask Rozi with AI. POST `{ message, consent: true, conversationId? }` (any `history` sent is ignored) with `Authorization: Bearer <Supabase access token>`.
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

  const token = bearerToken(request);
  const result = await handleRoziChat({ token, body, signal: request.signal }, {
    session: sessionFor,
    providers: () => roziAiProviders(),
    cooldowns,
    limiter,
    log: (entry) => console.info(JSON.stringify(entry)),
  });
  return Response.json(result.body, { status: result.status, headers });
}
