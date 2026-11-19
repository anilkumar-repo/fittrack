// ---------- Rozi AI: the browser side ----------
//
// The person's choice (on / off / not asked yet) is kept on this device. Questions go to POST /api/rozi/chat with the
// person's Supabase sign-in token; the server decides everything else (who they are, their data, limits, the model).
// Any problem comes back as a "fall back" result, so the screen can answer on the device instead.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { RoziChatBody } from "./handler";

export const ROZI_AI_CHOICE_KEY = "rozfit-rozi-ai";
export const ROZI_AI_CHOICE_EVENT = "rozfit-rozi-ai-changed";

/** "on", "off", or null when the person hasn't decided yet. */
export type RoziAiChoice = "on" | "off" | null;

export function readRoziAiChoice(): RoziAiChoice {
  try {
    const value = window.localStorage.getItem(ROZI_AI_CHOICE_KEY);
    return value === "on" || value === "off" ? value : null;
  } catch {
    return null;
  }
}

export function saveRoziAiChoice(choice: "on" | "off"): void {
  try { window.localStorage.setItem(ROZI_AI_CHOICE_KEY, choice); } catch { /* remembered for this visit only */ }
  window.dispatchEvent(new CustomEvent(ROZI_AI_CHOICE_EVENT, { detail: choice }));
}

const fallback = (reason: Extract<RoziChatBody, { ok: false }>["reason"], message: string): RoziChatBody => ({ ok: false, reason, message, fallback: true });

/** Asks Rozi's AI. Never throws: network trouble or an odd reply becomes a "fall back" result. */
export async function askRoziAi(client: SupabaseClient, message: string, fetcher: typeof fetch = fetch, conversationId: string | null = null): Promise<RoziChatBody> {
  let token: string | undefined;
  try {
    const { data } = await client.auth.getSession();
    token = data.session?.access_token;
  } catch { /* treated as signed out */ }
  if (!token) return fallback("sign-in", "Sign in to use Rozi AI.");
  try {
    const response = await fetcher("/api/rozi/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      // No chat history is sent: the server reads earlier turns from the saved conversation itself.
      body: JSON.stringify({ message, consent: true, ...(conversationId ? { conversationId } : {}) }),
      signal: AbortSignal.timeout(50_000),
    });
    const body = await response.json().catch(() => null) as RoziChatBody | null;
    if (!body || typeof body !== "object" || typeof body.ok !== "boolean") return fallback("error", "Rozi's AI sent an odd reply.");
    if (body.ok && (typeof body.text !== "string" || !Array.isArray(body.cards))) return fallback("error", "Rozi's AI sent an odd reply.");
    return body;
  } catch {
    return fallback("busy", "Rozi's AI couldn't be reached.");
  }
}
