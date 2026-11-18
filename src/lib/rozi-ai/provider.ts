// ---------- Rozi AI: the provider contract ----------
//
// Rozi talks to a model only through this interface, so the model (or provider) can change later — e.g. a paid tier
// with a stronger model — without touching Rozi's logic, tools or screen.

/** One part of a turn: text, a tool the model wants to run, or the result of running it. */
export type AiPart =
  /** `signature`: the provider's opaque "thought signature"; Gemini 3 requires it back unchanged on the next turn. */
  | { kind: "text"; text: string; signature?: string }
  | { kind: "tool-call"; id?: string; name: string; args: Record<string, unknown>; signature?: string }
  | { kind: "tool-result"; id?: string; name: string; result: Record<string, unknown> };

export interface AiTurn {
  /** "user" = the person (and tool results we send back); "model" = Rozi's earlier replies and tool requests. */
  role: "user" | "model";
  parts: AiPart[];
}

/** A tool the model may ask RozFit to run. `parameters` is a JSON Schema object. */
export interface AiTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface AiRequest {
  /** Rozi's persona and rules. */
  system: string;
  /** The conversation so far, ending with the newest user turn. */
  turns: AiTurn[];
  tools?: AiTool[];
  /** Ask for JSON matching this JSON Schema instead of free text. */
  jsonSchema?: Record<string, unknown>;
  maxOutputTokens?: number;
  temperature?: number;
  /** How hard the model thinks before answering: "low" is fast; "default" leaves it to the model. */
  thinking?: "low" | "high" | "default";
  /** Cancels the call (the provider also applies its own timeout). */
  signal?: AbortSignal;
}

export interface AiUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface AiResult {
  text: string;
  /** The model's turn exactly as it must be sent back in the next request (with any signatures). */
  modelTurn: AiTurn;
  /**
   * Tools the model asked to run. `invalidArgs` holds (a short piece of) the raw arguments when they weren't valid JSON;
   * such a call is not run — the model is told to try again.
   */
  toolCalls: Array<{ id?: string; name: string; args: Record<string, unknown>; invalidArgs?: string }>;
  /** Why the model stopped ("STOP", "MAX_TOKENS", "SAFETY", …), as the provider reports it. */
  finishReason: string | null;
  usage: AiUsage | null;
  model: string;
  latencyMs: number;
  /** What's left of the provider's rate limits after this call, when it reports them. */
  limits?: { remainingRequests: number | null; remainingTokens: number | null };
}

export type AiErrorCode =
  | "not-configured"
  | "timeout"
  | "rate-limited"
  | "unavailable"
  | "auth"
  | "model-not-found"
  | "bad-request"
  | "blocked"
  /** The model produced a tool call the provider couldn't parse (Groq: 400 with failed_generation). */
  | "bad-tool-call"
  | "empty";

/**
 * A failed model call. The message is safe to log and never contains the API key, the prompt or the person's data.
 * `retryable` says whether trying again later could help.
 */
export class RoziAiError extends Error {
  readonly code: AiErrorCode;
  readonly status: number | null;
  readonly retryable: boolean;
  /** How long the provider asked us to wait before trying again, when it said. */
  readonly retryAfterSeconds: number | null;
  constructor(code: AiErrorCode, message: string, options: { status?: number | null; retryable?: boolean; retryAfterSeconds?: number | null } = {}) {
    super(message);
    this.name = "RoziAiError";
    this.code = code;
    this.status = options.status ?? null;
    this.retryable = options.retryable ?? false;
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
  }
}

export interface AiProvider {
  readonly name: string;
  readonly model: string;
  generate(request: AiRequest): Promise<AiResult>;
}

/** Plain text of a turn's text parts. */
export function turnText(turn: AiTurn): string {
  return turn.parts.map((part) => (part.kind === "text" ? part.text : "")).join("").trim();
}
