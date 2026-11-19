// ---------- Rozi AI: one chat request, start to finish (server only) ----------
//
// Order of checks: signed in → valid request → opted in → AI configured → has a profile → adult → within the limit →
// ask. Every refusal says whether the app should answer on the device instead (`fallback: true`).
// The person is identified ONLY from their sign-in token — never from anything in the request body.

import { isAdultOn, needsBirthDate } from "../discover.ts";
import { hourIn } from "../dates.ts";
import { MAX_MESSAGE_LENGTH } from "../rozi-chat.ts";
import type { OwnTrainingData } from "../supabase-repository";
import type { RoziCard } from "./cards.ts";
import type { RoziAiIntent } from "./conversation.ts";
import { askRoziWithFallback, RoziAiChainError, type Cooldowns } from "./fallback.ts";
import type { ChatLine } from "./prompt.ts";
import { RoziAiError, type AiProvider } from "./provider.ts";
import type { RateLimiter } from "./rate-limit.ts";
import { isConversationId, type ReplyToSave, type StartQuestionResult } from "./history.ts";
import { redactContactDetails } from "./privacy.ts";
import type { RoziAiProviders } from "./server.ts";
import { selectTools } from "./tool-select.ts";
import { roziContext } from "./tools.ts";

export type RoziChatReason =
  | "sign-in"        // 401: no or expired sign-in
  | "invalid"        // 400: bad request body
  | "consent"        // 403: the person hasn't switched Rozi AI on
  | "off"            // 503: no AI provider configured on the server
  | "no-profile"     // 409: setup not finished
  | "adults-only"    // 403: under 18, or no birth year (provider terms)
  | "limit"          // 429: too many questions
  | "busy"           // 503: the AI provider is busy or rate-limited
  | "error";         // 502: the AI call failed

export type RoziChatBody =
  | { ok: true; text: string; cards: RoziCard[]; intent: RoziAiIntent; model: string; conversationId?: string }
  /** `conversationId`: set when the question was saved to history, so the app can save its on-phone answer there too. */
  | { ok: false; reason: RoziChatReason; message: string; fallback: boolean; retryAfterSeconds?: number; conversationId?: string };

export interface RoziChatResult { status: number; body: RoziChatBody }

export interface RoziChatSession {
  userId: string;
  /** Reads this person's own data with their own sign-in (RLS applies). */
  loadData(): Promise<OwnTrainingData | null>;
  /** Chat history in the database (stage 6). Absent or "unavailable" → no history and the in-memory limit is used. */
  history?: {
    /** Earlier turns of the person's OWN saved conversation (owner-checked in the database), or null. */
    load(conversationId: string | null): Promise<ChatLine[] | null>;
    start(conversationId: string | null, message: string): Promise<StartQuestionResult>;
    /** Saves the AI reply — server only (service role), after the sign-in was checked. */
    saveAiReply(conversationId: string, reply: Omit<ReplyToSave, "source">): Promise<boolean>;
  };
}

export interface RoziChatDeps {
  /** Checks the sign-in token; null if missing, invalid or expired. */
  session(token: string): Promise<RoziChatSession | null>;
  /** The configured models, in the order they're tried. */
  providers(): RoziAiProviders;
  /** Which models are resting after a failure (shared between requests on this server). */
  cooldowns?: Cooldowns;
  limiter: RateLimiter;
  now?: () => Date;
  /** Safe, content-free usage log (no message text, no user id). */
  log?: (entry: Record<string, unknown>) => void;
}

export interface RoziChatInput {
  token: string | null;
  body: unknown;
  signal?: AbortSignal;
}

/**
 * Validates the request body: `{ message, consent: true, conversationId? }`. Any `history` the browser sends is
 * IGNORED — earlier turns come only from the person's own saved conversation (see RoziChatSession.history.load), so
 * they can't be edited to steer the model.
 */
export function parseChatBody(body: unknown): { message: string; consent: boolean; conversationId: string | null } | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const value = body as Record<string, unknown>;
  if (typeof value.message !== "string") return null;
  const message = value.message.trim();
  if (!message || message.length > MAX_MESSAGE_LENGTH) return null;
  // An unknown or malformed conversation id just starts a new conversation (the database never attaches to
  // someone else's).
  return { message, consent: value.consent === true, conversationId: isConversationId(value.conversationId) ? value.conversationId : null };
}

/** Today (YYYY-MM-DD) in a time zone, at `now`. */
export function dayIn(timeZone: string, now: Date): string {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
    const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "00";
    return `${part("year")}-${part("month")}-${part("day")}`;
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

const refuse = (status: number, reason: RoziChatReason, message: string, fallback: boolean, retryAfterSeconds?: number, conversationId?: string | null): RoziChatResult =>
  ({ status, body: { ok: false, reason, message, fallback, ...(retryAfterSeconds ? { retryAfterSeconds } : {}), ...(conversationId ? { conversationId } : {}) } });

export async function handleRoziChat(input: RoziChatInput, deps: RoziChatDeps): Promise<RoziChatResult> {
  const now = deps.now?.() ?? new Date();
  const log = deps.log ?? (() => undefined);

  if (!input.token) return refuse(401, "sign-in", "Sign in to use Rozi AI.", true);
  const session = await deps.session(input.token).catch(() => null);
  if (!session) return refuse(401, "sign-in", "Your sign-in has expired. Please sign in again.", true);

  const request = parseChatBody(input.body);
  if (!request) return refuse(400, "invalid", `Ask a question of up to ${MAX_MESSAGE_LENGTH} characters.`, false);
  if (!request.consent) return refuse(403, "consent", "Switch on Rozi AI to get answers from Rozi's AI.", true);

  const available = deps.providers();
  if (!available.ok) {
    log({ event: "rozi_ai", ok: false, reason: "off", problem: available.problem });
    return refuse(503, "off", "Rozi AI isn't available right now.", true);
  }

  let data: OwnTrainingData | null;
  try {
    data = await session.loadData();
  } catch {
    return refuse(502, "error", "Your workouts couldn't be loaded right now.", true);
  }
  if (!data) return refuse(409, "no-profile", "Finish setting up RozFit first.", true);
  const today = dayIn(data.profile.timeZone, now);
  if (!isAdultOn(data.profile, today)) {
    return refuse(403, "adults-only", needsBirthDate(data.profile, today)
      ? "Rozi AI is for adults (18+). Add your date of birth in Settings → Your plan to confirm."
      : "Rozi AI is for adults (18+). Add your age or date of birth in Settings → Your plan.", true);
  }

  // Earlier turns: only from the person's own saved conversation, read BEFORE this question is recorded.
  const history = (session.history ? await session.history.load(request.conversationId).catch(() => null) : null) ?? [];

  // Record the question in history; the database enforces the limits (6 a minute, 60 a day) across all servers and
  // concurrent requests. Without history (migration not applied, or a database hiccup) the in-memory limit is used —
  // DEGRADED protection (per server instance, stricter numbers), logged as such.
  let conversationId: string | null = null;
  const started: StartQuestionResult = session.history
    ? await session.history.start(request.conversationId, request.message).catch(() => ({ kind: "unavailable" as const }))
    : { kind: "unavailable" };
  if (started.kind === "limited") {
    return refuse(429, "limit", started.limit === "day" ? "That's today's Rozi AI questions — back tomorrow! Here's what I can tell you myself." : "That's a lot of questions! Try again in a minute.", true, started.retryAfterSeconds);
  }
  if (started.kind === "ok") conversationId = started.conversationId;
  else {
    log({ event: "rozi_ai_limiter", mode: "memory-degraded" });
    const decision = deps.limiter.take(session.userId, now.getTime());
    if (!decision.allowed) return refuse(429, "limit", "That's a lot of questions! Try again in a little while.", true, decision.retryAfterSeconds);
  }

  // Contact details typed into a question (or earlier ones) never go to a provider.
  const question = { message: redactContactDetails(request.message), history: history.map((line) => ({ ...line, text: redactContactDetails(line.text) })) };
  const result = await ask(available.providers, deps.cooldowns, data, question, now, input.signal, log, conversationId);
  if (result.body.ok && conversationId && session.history) {
    const saved = await session.history.saveAiReply(conversationId, { text: result.body.text, intent: result.body.intent, model: result.body.model, cards: result.body.cards }).catch(() => false);
    if (!saved) log({ event: "rozi_ai_history", ok: false });
  }
  return result;
}

/** Models tried, for the log: "groq:openai/gpt-oss-20b=rate-limited, groq:openai/gpt-oss-120b=answered". */
const attemptLog = (attempts: Array<{ provider: string; model: string; outcome: string }>) => attempts.map((item) => `${item.provider}:${item.model}=${item.outcome}`).join(", ");

async function ask(providers: AiProvider[], cooldowns: Cooldowns | undefined, data: OwnTrainingData, request: { message: string; history: ChatLine[] }, now: Date, signal: AbortSignal | undefined, log: (entry: Record<string, unknown>) => void, conversationId: string | null): Promise<RoziChatResult> {
  const ctx = roziContext(data, dayIn(data.profile.timeZone, now), hourIn(data.profile.timeZone, now));
  const tools = selectTools(request.message, request.history);
  try {
    const answer = await askRoziWithFallback({ providers, cooldowns, ctx, message: request.message, history: request.history, signal, tools });
    log({ event: "rozi_ai", ok: true, model: answer.model, attempts: attemptLog(answer.attempts), intent: answer.intent, toolsOffered: tools.length, tools: answer.toolsUsed, latencyMs: answer.latencyMs, tokens: answer.usage.totalTokens });
    return { status: 200, body: { ok: true, text: answer.text, cards: answer.cards, intent: answer.intent, model: answer.model, ...(conversationId ? { conversationId } : {}) } };
  } catch (error) {
    const code = error instanceof RoziAiError ? error.code : "unknown";
    log({ event: "rozi_ai", ok: false, code, attempts: error instanceof RoziAiChainError ? attemptLog(error.attempts) : "" });
    if (error instanceof RoziAiError && (error.code === "rate-limited" || error.code === "unavailable" || error.code === "timeout")) {
      return refuse(503, "busy", "Rozi's AI is busy right now — here's what I can tell you myself.", true, error.retryAfterSeconds ?? undefined, conversationId);
    }
    return refuse(502, "error", "Rozi's AI couldn't answer that — here's what I can tell you myself.", true, undefined, conversationId);
  }
}
