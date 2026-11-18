// ---------- Rozi AI: Google Gemini provider (server only) ----------
//
// Uses the official Google Gen AI SDK (`@google/genai`). The API key is passed in from the server configuration and
// never reaches the browser, logs or error messages.

import { GoogleGenAI } from "@google/genai";
import { ROZI_AI_LIMITS, type RoziAiConfig } from "./config.ts";
import { RoziAiError, type AiPart, type AiProvider, type AiRequest, type AiResult, type AiTurn } from "./provider.ts";

/** The small part of the SDK client this provider uses (so tests can stand in for it). */
export interface GeminiClient {
  models: { generateContent(params: GeminiParams): Promise<GeminiResponse> };
}

export interface GeminiParams {
  model: string;
  contents: Array<{ role: "user" | "model"; parts: Array<Record<string, unknown>> }>;
  config: Record<string, unknown>;
}

/** The fields of a Gemini response this provider reads. */
export interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string; thought?: boolean; thoughtSignature?: string; functionCall?: { id?: string; name?: string; args?: Record<string, unknown> } }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
}

const BLOCKED_FINISH = new Set(["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION"]);

function toGeminiPart(part: AiPart): Record<string, unknown> {
  const signature = part.kind !== "tool-result" && part.signature ? { thoughtSignature: part.signature } : {};
  if (part.kind === "text") return { text: part.text, ...signature };
  if (part.kind === "tool-call") return { functionCall: { ...(part.id ? { id: part.id } : {}), name: part.name, args: part.args }, ...signature };
  return { functionResponse: { ...(part.id ? { id: part.id } : {}), name: part.name, response: part.result } };
}

/** Converts Rozi's provider-neutral request into the SDK's parameters. */
export function toGeminiParams(model: string, request: AiRequest, signal?: AbortSignal): GeminiParams {
  const config: Record<string, unknown> = {
    systemInstruction: request.system,
    maxOutputTokens: request.maxOutputTokens ?? ROZI_AI_LIMITS.maxOutputTokens,
    temperature: request.temperature ?? 0.6,
  };
  const thinking = request.thinking ?? ROZI_AI_LIMITS.thinking;
  if (thinking !== "default") config.thinkingConfig = { thinkingLevel: thinking === "high" ? "HIGH" : "LOW" };
  if (request.tools?.length) {
    config.tools = [{ functionDeclarations: request.tools.map((tool) => ({ name: tool.name, description: tool.description, parametersJsonSchema: tool.parameters })) }];
  }
  if (request.jsonSchema) {
    config.responseMimeType = "application/json";
    config.responseJsonSchema = request.jsonSchema;
  }
  if (signal) config.abortSignal = signal;
  return {
    model,
    contents: request.turns.map((turn: AiTurn) => ({ role: turn.role, parts: turn.parts.map(toGeminiPart) })),
    config,
  };
}

/** Reads text (without the model's private "thought" parts), tool calls, finish reason and token usage. */
export function fromGeminiResponse(response: GeminiResponse, model: string, latencyMs: number): AiResult {
  if (response.promptFeedback?.blockReason) {
    throw new RoziAiError("blocked", `The request was blocked (${response.promptFeedback.blockReason}).`);
  }
  const candidate = response.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  const text = parts.filter((part) => typeof part.text === "string" && !part.thought).map((part) => part.text).join("").trim();
  const toolCalls = parts
    .filter((part) => part.functionCall?.name)
    .map((part) => ({ ...(part.functionCall!.id ? { id: part.functionCall!.id } : {}), name: part.functionCall!.name!, args: part.functionCall!.args ?? {} }));
  const finishReason = candidate?.finishReason ?? null;
  if (!text && !toolCalls.length) {
    if (finishReason && BLOCKED_FINISH.has(finishReason)) throw new RoziAiError("blocked", `The answer was blocked (${finishReason}).`);
    throw new RoziAiError("empty", "The model returned no answer.", { retryable: true });
  }
  const usage = response.usageMetadata
    ? {
      inputTokens: response.usageMetadata.promptTokenCount ?? 0,
      outputTokens: response.usageMetadata.candidatesTokenCount ?? 0,
      totalTokens: response.usageMetadata.totalTokenCount ?? 0,
    }
    : null;
  // The model's own turn, to send back as-is in a follow-up (tool results): visible parts with their signatures.
  const modelParts: AiPart[] = [];
  for (const part of parts) {
    if (part.thought) continue;
    const signature = part.thoughtSignature ? { signature: part.thoughtSignature } : {};
    if (part.functionCall?.name) modelParts.push({ kind: "tool-call", ...(part.functionCall.id ? { id: part.functionCall.id } : {}), name: part.functionCall.name, args: part.functionCall.args ?? {}, ...signature });
    else if (typeof part.text === "string") modelParts.push({ kind: "text", text: part.text, ...signature });
  }
  return { text, modelTurn: { role: "model", parts: modelParts }, toolCalls, finishReason, usage, model, latencyMs };
}

/** Turns any SDK or network failure into a safe RoziAiError (no key, prompt or raw server text). */
export function toRoziAiError(error: unknown, timedOut: boolean): RoziAiError {
  if (error instanceof RoziAiError) return error;
  if (timedOut) return new RoziAiError("timeout", "The model took too long to answer.", { retryable: true });
  const status = typeof (error as { status?: unknown })?.status === "number" ? (error as { status: number }).status : null;
  if ((error as { name?: string })?.name === "AbortError") return new RoziAiError("unavailable", "The model call was cancelled.", { retryable: true });
  if (status === 400) return new RoziAiError("bad-request", "The model rejected the request.", { status });
  if (status === 401 || status === 403) return new RoziAiError("auth", "The Gemini API key was refused. Check GEMINI_API_KEY.", { status });
  if (status === 404) return new RoziAiError("model-not-found", "The configured model isn't available. Check ROZI_AI_MODEL.", { status });
  if (status === 429) return new RoziAiError("rate-limited", "The Gemini quota is used up for now.", { status, retryable: true });
  if (status === 503) return new RoziAiError("unavailable", "Gemini is busy right now (high demand). Try again in a few minutes.", { status, retryable: true });
  if (status !== null && status >= 500) return new RoziAiError("unavailable", "Gemini is unavailable right now.", { status, retryable: true });
  return new RoziAiError("unavailable", "The model couldn't be reached.", { status, retryable: true });
}

/**
 * Rozi's Gemini provider. Each call has a hard timeout; on any failure it throws a RoziAiError and the caller
 * answers on the device instead. Pass `client` only in tests.
 */
export function createGeminiProvider(config: RoziAiConfig, client?: GeminiClient, timeoutMs: number = ROZI_AI_LIMITS.timeoutMs): AiProvider {
  if (typeof window !== "undefined") throw new RoziAiError("not-configured", "Rozi AI runs on the server only.");
  const sdk: GeminiClient = client ?? (new GoogleGenAI({
    apiKey: config.apiKey,
    httpOptions: { retryOptions: { attempts: ROZI_AI_LIMITS.attempts, initialDelay: 1, maxDelay: 2 } },
  }) as unknown as GeminiClient);
  return {
    name: "gemini",
    model: config.model,
    async generate(request: AiRequest): Promise<AiResult> {
      const controller = new AbortController();
      let timedOut = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const onOuterAbort = () => controller.abort();
      request.signal?.addEventListener("abort", onOuterAbort, { once: true });
      const started = Date.now();
      try {
        const timeout = new Promise<never>((_, reject) => {
          timer = setTimeout(() => { timedOut = true; controller.abort(); reject(new Error("timeout")); }, timeoutMs);
        });
        const response = await Promise.race([sdk.models.generateContent(toGeminiParams(config.model, request, controller.signal)), timeout]);
        return fromGeminiResponse(response, config.model, Date.now() - started);
      } catch (error) {
        throw toRoziAiError(error, timedOut);
      } finally {
        if (timer) clearTimeout(timer);
        request.signal?.removeEventListener("abort", onOuterAbort);
      }
    },
  };
}
