// ---------- Rozi AI: pick the provider from the environment (server only) ----------

import { readRoziAiChain, readRoziAiConfig, type RoziAiConfig, type RoziAiConfigProblem } from "./config.ts";
import { createGeminiProvider } from "./gemini-provider.ts";
import { createGroqProvider } from "./groq-provider.ts";
import type { AiProvider } from "./provider.ts";

export type RoziAiAvailability = { ok: true; provider: AiProvider } | { ok: false; problem: RoziAiConfigProblem };

/** The provider for a validated configuration. */
export function providerFor(config: RoziAiConfig): AiProvider {
  return config.provider === "groq" ? createGroqProvider(config) : createGeminiProvider(config);
}

/** The configured provider, or why Rozi AI is off (then Rozi answers on the device). */
export function roziAiProvider(env: Record<string, string | undefined> = process.env, choose: { provider?: string; model?: string } = {}): RoziAiAvailability {
  const result = readRoziAiConfig(env, choose);
  if (!result.ok) return result;
  return { ok: true, provider: providerFor(result.config) };
}

export type RoziAiProviders = { ok: true; providers: AiProvider[] } | { ok: false; problem: RoziAiConfigProblem };

/** Every configured model, in ROZI_AI_CHAIN order (or the single ROZI_AI_PROVIDER / ROZI_AI_MODEL). */
export function roziAiProviders(env: Record<string, string | undefined> = process.env): RoziAiProviders {
  const result = readRoziAiChain(env);
  if (!result.ok) return { ok: false, problem: result.problem };
  return { ok: true, providers: result.chain.configs.map(providerFor) };
}
