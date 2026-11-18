// ---------- Rozi AI: Groq provider (server only) ----------
//
// Uses the official `groq-sdk` (OpenAI-compatible chat completions). Rozi's provider-neutral turns are translated to
// Groq messages here; Gemini-only details (thought signatures) are dropped and never sent to Groq. The API key is
// passed in from the server configuration and never reaches the browser, logs or error messages.

import Groq from "groq-sdk";
import { ROZI_AI_LIMITS, type RoziAiConfig } from "./config.ts";
import { RoziAiError, type AiProvider, type AiRequest, type AiResult, type AiTurn } from "./provider.ts";

// ---------- The Groq wire format (only the fields Rozi uses) ----------

export interface GroqToolCall { id: string; type: "function"; function: { name: string; arguments: string } }

export type GroqMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: GroqToolCall[] }
  | { role: "tool"; tool_call_id: string; name: string; content: string };

export interface GroqParams {
  model: string;
  messages: GroqMessage[];
  tools?: Array<{ type: "function"; function: { name: string; description: string; parameters: Record<string, unknown> } }>;
  tool_choice?: "auto";
  max_completion_tokens: number;
  temperature?: number;
  reasoning_effort?: "none" | "default" | "low" | "medium" | "high";
  reasoning_format?: "hidden";
  include_reasoning?: boolean;
  response_format?: { type: "json_schema"; json_schema: { name: string; schema: Record<string, unknown> } };
}

export interface GroqResponse {
  choices?: Array<{ message?: { content?: string | null; tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }> | null }; finish_reason?: string | null }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

/** The small part of the SDK this provider uses (so tests can stand in for it). */
export interface GroqClient {
  complete(params: GroqParams, signal: AbortSignal): Promise<{ body: GroqResponse; headers: Headers | null }>;
}

/** Wraps the real SDK. Retries are done here in the provider (bounded, and never a long retry-after wait). */
function sdkClient(apiKey: string, timeoutMs: number): GroqClient {
  const sdk = new Groq({ apiKey, maxRetries: 0, timeout: timeoutMs });
  return {
    async complete(params, signal) {
      const { data, response } = await sdk.chat.completions.create(params as never, { signal }).withResponse();
      return { body: data as unknown as GroqResponse, headers: response.headers };
    },
  };
}

// ---------- Rozi turns → Groq messages ----------

/**
 * Converts the conversation. Tool calls without an id (they never come from Groq, but could come from elsewhere) get
 * stable ids, and their results are matched to them by order.
 */
export function toGroqMessages(system: string, turns: AiTurn[]): GroqMessage[] {
  const messages: GroqMessage[] = [{ role: "system", content: system }];
  let pending: Array<{ id: string; name: string }> = [];
  turns.forEach((turn, turnIndex) => {
    const text = turn.parts.map((part) => (part.kind === "text" ? part.text : "")).join("").trim();
    if (turn.role === "model") {
      const calls = turn.parts.flatMap((part, partIndex) => part.kind === "tool-call"
        ? [{ id: part.id || `call_${turnIndex}_${partIndex}`, type: "function" as const, function: { name: part.name, arguments: JSON.stringify(part.args ?? {}) } }]
        : []);
      pending = calls.map((call) => ({ id: call.id, name: call.function.name }));
      messages.push(calls.length ? { role: "assistant", content: text || null, tool_calls: calls } : { role: "assistant", content: text });
      return;
    }
    for (const part of turn.parts) {
      if (part.kind !== "tool-result") continue;
      const match = part.id ? { id: part.id } : pending.find((item) => item.name === part.name) ?? { id: `call_${turnIndex}_${part.name}` };
      pending = pending.filter((item) => item.id !== match.id);
      messages.push({ role: "tool", tool_call_id: match.id, name: part.name, content: JSON.stringify(part.result) });
    }
    if (text) messages.push({ role: "user", content: text });
  });
  return messages;
}

/** Reasoning settings per model family: gpt-oss uses effort + no reasoning text; Qwen uses effort + hidden reasoning. */
function reasoningFor(model: string, thinking: "low" | "high" | "default"): Partial<GroqParams> {
  if (thinking === "default") return {};
  if (model.startsWith("openai/gpt-oss")) return { reasoning_effort: thinking, include_reasoning: false };
  if (model.startsWith("qwen/")) return { reasoning_effort: thinking, reasoning_format: "hidden" };
  return {};
}

/**
 * Groq checks every tool call against the tool's JSON Schema, and gpt-oss sends `null` for optional arguments it leaves
 * empty ("exercise": null), which a plain `"type": "string"` rejects (400 tool_use_failed, seen in the benchmark
 * 2026-11-18). So for Groq, optional properties also accept null. Rozi's tools already treat null as "not given".
 */
export function nullableOptional(parameters: Record<string, unknown>): Record<string, unknown> {
  const properties = parameters.properties as Record<string, Record<string, unknown>> | undefined;
  if (!properties) return parameters;
  const required = new Set(Array.isArray(parameters.required) ? (parameters.required as string[]) : []);
  const next: Record<string, Record<string, unknown>> = {};
  for (const [name, property] of Object.entries(properties)) {
    if (required.has(name) || typeof property.type !== "string") { next[name] = property; continue; }
    next[name] = {
      ...property,
      type: [property.type, "null"],
      ...(Array.isArray(property.enum) ? { enum: [...property.enum, null] } : {}),
    };
  }
  return { ...parameters, properties: next };
}

export function toGroqParams(model: string, request: AiRequest): GroqParams {
  const params: GroqParams = {
    model,
    messages: toGroqMessages(request.system, request.turns),
    max_completion_tokens: request.maxOutputTokens ?? ROZI_AI_LIMITS.maxOutputTokens,
    temperature: request.temperature ?? 0.6,
    ...reasoningFor(model, request.thinking ?? ROZI_AI_LIMITS.thinking),
  };
  if (request.tools?.length) {
    params.tools = request.tools.map((tool) => ({ type: "function", function: { name: tool.name, description: tool.description, parameters: nullableOptional(tool.parameters) } }));
    params.tool_choice = "auto";
  }
  if (request.jsonSchema) params.response_format = { type: "json_schema", json_schema: { name: "rozi_answer", schema: request.jsonSchema } };
  return params;
}

// ---------- Groq response → Rozi result ----------

function headerNumber(headers: Headers | null, name: string): number | null {
  const value = Number(headers?.get(name));
  return headers?.has(name) && Number.isFinite(value) ? value : null;
}

export function fromGroqResponse(body: GroqResponse, headers: Headers | null, model: string, latencyMs: number): AiResult {
  const choice = body.choices?.[0];
  const text = (choice?.message?.content ?? "").trim();
  const toolCalls = (choice?.message?.tool_calls ?? []).filter((call) => call.function?.name).map((call, index) => {
    const raw = call.function?.arguments ?? "";
    const id = call.id || `call_${index}`;
    try {
      const parsed = raw.trim() ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return { id, name: call.function!.name!, args: parsed as Record<string, unknown> };
    } catch { /* falls through: invalid */ }
    return { id, name: call.function!.name!, args: {}, invalidArgs: raw.slice(0, 200) };
  });
  const finishReason = choice?.finish_reason ?? null;
  if (!text && !toolCalls.length) {
    if (finishReason === "content_filter") throw new RoziAiError("blocked", "The answer was blocked (content_filter).");
    throw new RoziAiError("empty", "The model returned no answer.", { retryable: true });
  }
  const usage = body.usage ? { inputTokens: body.usage.prompt_tokens ?? 0, outputTokens: body.usage.completion_tokens ?? 0, totalTokens: body.usage.total_tokens ?? 0 } : null;
  return {
    text,
    modelTurn: {
      role: "model",
      parts: [
        ...(text ? [{ kind: "text" as const, text }] : []),
        ...toolCalls.map((call) => ({ kind: "tool-call" as const, id: call.id, name: call.name, args: call.args })),
      ],
    },
    toolCalls, finishReason, usage, model, latencyMs,
    limits: headers ? { remainingRequests: headerNumber(headers, "x-ratelimit-remaining-requests"), remainingTokens: headerNumber(headers, "x-ratelimit-remaining-tokens") } : undefined,
  };
}

/** Longest provider-requested wait we'll do inside one Rozi answer before giving up (seconds). */
const MAX_RETRY_WAIT_SECONDS = 3;

/** Turns any SDK or network failure into a safe RoziAiError (no key, prompt or raw server text). */
export function toGroqError(error: unknown, timedOut: boolean): RoziAiError {
  if (error instanceof RoziAiError) return error;
  if (timedOut) return new RoziAiError("timeout", "The model took too long to answer.", { retryable: true });
  const status = typeof (error as { status?: unknown })?.status === "number" ? (error as { status: number }).status : null;
  const headers = (error as { headers?: Headers })?.headers;
  const retryAfterRaw = headers && typeof headers.get === "function" ? Number(headers.get("retry-after")) : NaN;
  const retryAfterSeconds = Number.isFinite(retryAfterRaw) && retryAfterRaw >= 0 ? retryAfterRaw : null;
  const body = (error as { error?: { error?: { code?: string; failed_generation?: unknown } } })?.error?.error;
  if ((error as { name?: string })?.name === "AbortError") return new RoziAiError("unavailable", "The model call was cancelled.", { retryable: true });
  if (status === 400 && (body?.code === "tool_use_failed" || body?.failed_generation !== undefined)) {
    return new RoziAiError("bad-tool-call", "The model made a tool call that couldn't be read.", { status, retryable: true });
  }
  if (status === 400 || status === 413 || status === 422) return new RoziAiError("bad-request", "The model rejected the request.", { status });
  if (status === 401 || status === 403) return new RoziAiError("auth", "The Groq API key was refused. Check GROQ_API_KEY.", { status });
  if (status === 404) return new RoziAiError("model-not-found", "The configured model isn't available. Check ROZI_AI_MODEL.", { status });
  if (status === 429) return new RoziAiError("rate-limited", "The Groq rate limit is reached for now.", { status, retryable: true, retryAfterSeconds });
  if (status === 498 || status === 503) return new RoziAiError("unavailable", "Groq is busy right now. Try again in a moment.", { status, retryable: true, retryAfterSeconds });
  if (status !== null && status >= 500) return new RoziAiError("unavailable", "Groq is unavailable right now.", { status, retryable: true });
  return new RoziAiError("unavailable", "The model couldn't be reached.", { status, retryable: true });
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
  });
}

/**
 * Rozi's Groq provider. One time budget per call (timeout) covers every attempt; at most `ROZI_AI_LIMITS.attempts`
 * attempts, retrying only busy/rate-limit/bad-tool-call failures, and only when the provider's requested wait is short.
 * Pass `client` only in tests.
 */
export function createGroqProvider(config: RoziAiConfig, client?: GroqClient, timeoutMs: number = ROZI_AI_LIMITS.timeoutMs): AiProvider {
  if (typeof window !== "undefined") throw new RoziAiError("not-configured", "Rozi AI runs on the server only.");
  const api = client ?? sdkClient(config.apiKey, timeoutMs);
  return {
    name: "groq",
    model: config.model,
    async generate(request: AiRequest): Promise<AiResult> {
      const controller = new AbortController();
      let timedOut = false;
      const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
      const onOuterAbort = () => controller.abort();
      request.signal?.addEventListener("abort", onOuterAbort, { once: true });
      const params = toGroqParams(config.model, request);
      const started = Date.now();
      try {
        for (let attempt = 1; ; attempt++) {
          try {
            const timeout = new Promise<never>((_, reject) => controller.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true }));
            const { body, headers } = await Promise.race([api.complete(params, controller.signal), timeout]);
            return fromGroqResponse(body, headers, config.model, Date.now() - started);
          } catch (error) {
            const failure = toGroqError(error, timedOut);
            const wait = failure.retryAfterSeconds ?? 0.5;
            const canRetry = failure.retryable && failure.code !== "timeout" && failure.code !== "empty" && attempt < ROZI_AI_LIMITS.attempts && wait <= MAX_RETRY_WAIT_SECONDS && !controller.signal.aborted;
            if (!canRetry) throw failure;
            await sleep(wait * 1000, controller.signal);
          }
        }
      } finally {
        clearTimeout(timer);
        request.signal?.removeEventListener("abort", onOuterAbort);
      }
    },
  };
}
