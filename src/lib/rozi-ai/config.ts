// ---------- Rozi AI: configuration (server only) ----------
//
// Read from environment variables, never from code:
//   ROZI_AI_PROVIDER  "gemini" (default) or "groq"
//   ROZI_AI_MODEL     e.g. "gemini-3.8-flash" or "openai/gpt-oss-120b" (default: the provider's default below)
//   GEMINI_API_KEY    Google AI Studio key — needed when the provider is gemini
//   GROQ_API_KEY      GroqCloud key — needed when the provider is groq
// Keys are secrets: server only, never NEXT_PUBLIC_. If the configured model is unavailable, Rozi falls back to its
// on-device answers; it never switches provider or model silently.

export type RoziAiProviderName = "gemini" | "groq";
export const PROVIDERS: RoziAiProviderName[] = ["gemini", "groq"];

/** Each provider's default model (used when ROZI_AI_MODEL is empty). */
export const DEFAULT_MODELS: Record<RoziAiProviderName, string> = { gemini: "gemini-3.8-flash", groq: "openai/gpt-oss-120b" };
/** Kept for older imports: the default provider's default model. */
export const DEFAULT_MODEL = DEFAULT_MODELS.gemini;
/** Where each provider's key lives. */
export const KEY_VARIABLE: Record<RoziAiProviderName, string> = { gemini: "GEMINI_API_KEY", groq: "GROQ_API_KEY" };

/** Limits that keep answers short, fast and cheap. */
export const ROZI_AI_LIMITS = {
  /** Give up on a model call after this long, and answer on the device instead. */
  timeoutMs: 20_000,
  /**
   * Gemini 3.x "thinks" before answering, and thinking counts toward this limit (measured 2026-11-18: 330–430 thought
   * tokens for a 30-token answer). Answer length is kept short by the instructions, not by this number.
   */
  maxOutputTokens: 2048,
  /**
   * How hard the model thinks. "low" measured ~5 s per answer on gemini-3.8-flash; the model's default took 20–64 s.
   * ("minimal" isn't supported by gemini-3.8-flash.)
   */
  thinking: "low",
  /**
   * Total attempts per call, counting the first. The SDK's default is 5 with growing delays, which turned a busy
   * Gemini (503 "high demand", seen on the free tier 2026-11-18) into 45–90 s waits. One quick retry, then Rozi answers on
   * the device.
   */
  attempts: 2,
  /** Earlier turns sent for follow-up questions ("and last week?"). */
  maxHistoryTurns: 8,
  /** Each earlier turn is cut to this many characters. */
  maxHistoryChars: 600,
} as const;

export interface RoziAiConfig {
  provider: RoziAiProviderName;
  model: string;
  apiKey: string;
}

export type RoziAiConfigProblem =
  | "missing-key"
  /** The key was also set under a NEXT_PUBLIC_ name, which would ship it to every browser. Refused until removed. */
  | "exposed-key"
  | "unsupported-provider"
  | "invalid-model"
  /** More than MAX_CHAIN usable models in ROZI_AI_CHAIN; the extra ones are left out. */
  | "too-many";

export type RoziAiConfigResult = { ok: true; config: RoziAiConfig } | { ok: false; problem: RoziAiConfigProblem };

type Env = Record<string, string | undefined>;

/**
 * Validates the AI settings. `choose` picks a provider/model explicitly (the benchmark uses it); otherwise the
 * environment decides. Never returns or logs a key in a problem.
 */
export function readRoziAiConfig(env: Env = process.env, choose: { provider?: string; model?: string } = {}): RoziAiConfigResult {
  if (Object.keys(env).some((name) => name.startsWith("NEXT_PUBLIC_") && /GEMINI|GOOGLE_API|GENAI|GROQ/i.test(name) && env[name])) {
    return { ok: false, problem: "exposed-key" };
  }
  const provider = (choose.provider ?? env.ROZI_AI_PROVIDER ?? "gemini").trim().toLowerCase() as RoziAiProviderName;
  if (!PROVIDERS.includes(provider)) return { ok: false, problem: "unsupported-provider" };
  const model = (choose.model ?? env.ROZI_AI_MODEL ?? "").trim() || DEFAULT_MODELS[provider];
  if (!/^[a-z0-9][a-z0-9./-]{2,79}$/.test(model) || model.includes("..") || model.includes("//")) return { ok: false, problem: "invalid-model" };
  const apiKey = (env[KEY_VARIABLE[provider]] ?? "").trim();
  if (!apiKey) return { ok: false, problem: "missing-key" };
  return { ok: true, config: { provider, model, apiKey } };
}

// ---------- Several models, tried in order (ROZI_AI_CHAIN) ----------

/** At most this many models in the chain. */
export const MAX_CHAIN = 4;

export interface RoziAiChain {
  /** Usable models, in the order they're tried. */
  configs: RoziAiConfig[];
  /** Entries left out, and why (e.g. a missing key). Never contains a key. */
  skipped: Array<{ entry: string; problem: RoziAiConfigProblem }>;
}

export type RoziAiChainResult = { ok: true; chain: RoziAiChain } | { ok: false; problem: RoziAiConfigProblem; skipped: RoziAiChain["skipped"] };

/**
 * The models Rozi may use, in order. `ROZI_AI_CHAIN` lists them as `provider:model` separated by commas, e.g.
 * `groq:openai/gpt-oss-20b, groq:openai/gpt-oss-120b, gemini:gemini-3.5-flash-lite`. Without it, the single
 * ROZI_AI_PROVIDER / ROZI_AI_MODEL pair is used. Entries without a key (or invalid) are skipped and reported; the order
 * is never changed and no model outside the list is ever used.
 */
export function readRoziAiChain(env: Env = process.env): RoziAiChainResult {
  const raw = (env.ROZI_AI_CHAIN ?? "").trim();
  if (!raw) {
    const single = readRoziAiConfig(env);
    return single.ok ? { ok: true, chain: { configs: [single.config], skipped: [] } } : { ok: false, problem: single.problem, skipped: [] };
  }
  const configs: RoziAiConfig[] = [];
  const skipped: RoziAiChain["skipped"] = [];
  const seen = new Set<string>();
  for (const entry of raw.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 12)) {
    const split = entry.indexOf(":");
    const provider = split > 0 ? entry.slice(0, split).trim() : "";
    const model = split > 0 ? entry.slice(split + 1).trim() : "";
    if (!provider || !model) { skipped.push({ entry: entry.slice(0, 80), problem: "invalid-model" }); continue; }
    const result = readRoziAiConfig(env, { provider, model });
    if (!result.ok) {
      if (result.problem === "exposed-key") return { ok: false, problem: "exposed-key", skipped };
      skipped.push({ entry: `${provider}:${model}`.slice(0, 80), problem: result.problem });
      continue;
    }
    const key = `${result.config.provider}:${result.config.model}`;
    if (seen.has(key)) continue;
    if (configs.length >= MAX_CHAIN) { skipped.push({ entry: key.slice(0, 80), problem: "too-many" }); continue; }
    seen.add(key);
    configs.push(result.config);
  }
  return configs.length ? { ok: true, chain: { configs, skipped } } : { ok: false, problem: skipped[0]?.problem ?? "invalid-model", skipped };
}

/** "groq · openai/gpt-oss-20b → groq · openai/gpt-oss-120b → gemini · gemini-3.5-flash-lite" (no keys). */
export function describeChain(result: RoziAiChainResult): string {
  if (!result.ok) return `Rozi AI off: ${result.problem}${result.skipped.length ? ` (skipped: ${result.skipped.map((item) => `${item.entry} ${item.problem}`).join("; ")})` : ""}`;
  const order = result.chain.configs.map((config) => `${config.provider} · ${config.model}`).join(" → ");
  return result.chain.skipped.length ? `${order} (skipped: ${result.chain.skipped.map((item) => `${item.entry} ${item.problem}`).join("; ")})` : order;
}

/** A short, safe description for logs and health checks ("gemini · gemini-3.8-flash · key set"). */
export function describeConfig(result: RoziAiConfigResult): string {
  if (!result.ok) return `Rozi AI off: ${result.problem}`;
  return `${result.config.provider} · ${result.config.model} · key set`;
}
