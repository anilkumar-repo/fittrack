// ---------- Rozi AI: try the configured models in order ----------
//
// Fallback is per QUESTION: if a model fails (busy, rate-limited, slow, a broken tool call…), the whole question is
// asked again from the start on the next model in ROZI_AI_CHAIN. Models are never mixed inside one answer (Gemini needs
// its own thought signatures, Groq its own message format), and Rozi's tools only read, so asking again is safe.
// A model that just failed rests for a while, so the next questions don't wait on it. Safety blocks are never routed
// around. Every attempt is recorded so logs show which model answered.

import { askRozi, type AskRoziInput, type RoziAnswer } from "./conversation.ts";
import { RoziAiError, type AiErrorCode, type AiProvider } from "./provider.ts";

/** How long a model rests after each kind of failure (ms), unless the provider said how long to wait. */
const REST_MS: Partial<Record<AiErrorCode, number>> = {
  "rate-limited": 30_000,
  unavailable: 15_000,
  timeout: 15_000,
  "bad-tool-call": 0,
  empty: 0,
  "bad-request": 60_000,
  auth: 10 * 60_000,
  "model-not-found": 10 * 60_000,
  "not-configured": 10 * 60_000,
};

/** The whole question (all models together) must finish within this, so the screen never waits too long. */
export const QUESTION_BUDGET_MS = 40_000;

export interface Cooldowns {
  until(key: string): number;
  rest(key: string, untilMs: number): void;
}

/** Remembers which models are resting (kept in the server's memory). */
export function createCooldowns(): Cooldowns {
  const resting = new Map<string, number>();
  return {
    until: (key) => resting.get(key) ?? 0,
    rest: (key, untilMs) => { if (untilMs > (resting.get(key) ?? 0)) resting.set(key, untilMs); },
  };
}

export interface FallbackAttempt {
  provider: string;
  model: string;
  /** "answered", "resting" (skipped, still resting from an earlier failure), "out-of-time", or the error code. */
  outcome: "answered" | "resting" | "out-of-time" | AiErrorCode;
  ms: number;
}

export type FallbackAnswer = RoziAnswer & { attempts: FallbackAttempt[]; fallbackUsed: boolean };

export interface FallbackInput extends Omit<AskRoziInput, "provider"> {
  providers: AiProvider[];
  cooldowns?: Cooldowns;
  budgetMs?: number;
  now?: () => number;
}

const keyOf = (provider: AiProvider) => `${provider.name}:${provider.model}`;

/** Thrown when every model failed or was resting; carries what happened for the logs. */
export class RoziAiChainError extends RoziAiError {
  readonly attempts: FallbackAttempt[];
  constructor(last: RoziAiError, attempts: FallbackAttempt[], retryAfterSeconds: number | null) {
    super(last.code, last.message, { status: last.status, retryable: last.retryable, retryAfterSeconds: retryAfterSeconds ?? last.retryAfterSeconds });
    this.name = "RoziAiChainError";
    this.attempts = attempts;
  }
}

export async function askRoziWithFallback({ providers, cooldowns = createCooldowns(), budgetMs = QUESTION_BUDGET_MS, now = Date.now, ...question }: FallbackInput): Promise<FallbackAnswer> {
  if (!providers.length) throw new RoziAiError("not-configured", "No AI model is configured.");
  const started = now();
  const attempts: FallbackAttempt[] = [];
  let last: RoziAiError | null = null;

  for (const provider of providers) {
    const key = keyOf(provider);
    const at = now();
    if (cooldowns.until(key) > at) {
      attempts.push({ provider: provider.name, model: provider.model, outcome: "resting", ms: 0 });
      continue;
    }
    if (at - started >= budgetMs) {
      attempts.push({ provider: provider.name, model: provider.model, outcome: "out-of-time", ms: 0 });
      break;
    }
    try {
      const answer = await askRozi({ ...question, provider });
      attempts.push({ provider: provider.name, model: provider.model, outcome: "answered", ms: now() - at });
      return { ...answer, attempts, fallbackUsed: attempts.length > 1 };
    } catch (error) {
      const failure = error instanceof RoziAiError ? error : new RoziAiError("unavailable", "The model couldn't be reached.", { retryable: true });
      attempts.push({ provider: provider.name, model: provider.model, outcome: failure.code, ms: now() - at });
      last = failure;
      // A safety block is the answer, not a fault: never try another model to get around it. Same if the person left.
      if (failure.code === "blocked" || question.signal?.aborted) throw new RoziAiChainError(failure, attempts, null);
      const rest = failure.retryAfterSeconds !== null ? failure.retryAfterSeconds * 1000 : REST_MS[failure.code] ?? 15_000;
      if (rest > 0) cooldowns.rest(key, now() + rest);
    }
  }

  // Nothing answered: report the last real failure, or "rate-limited" if every model was resting.
  const soonest = Math.min(...providers.map((provider) => cooldowns.until(keyOf(provider)) - now()).filter((ms) => ms > 0));
  const wait = Number.isFinite(soonest) ? Math.ceil(soonest / 1000) : null;
  throw new RoziAiChainError(last ?? new RoziAiError("rate-limited", "Every AI model is resting after hitting its limit.", { retryable: true }), attempts, wait);
}
