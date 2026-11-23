// ---------- Rozi actions: binding an approval to the exact change (SERVER ONLY) ----------
//
// The payload hash ties an approval to one person, one action type and one exact payload. The card sends back the
// hash it showed; the database refuses a different one (rozi_start_action). The idempotency key makes proposing the
// same change twice return the same row.

import { createHash } from "node:crypto";
import type { ActionPayload } from "./action-types.ts";

/** JSON with object keys sorted at every level, so the same change always hashes the same. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>).sort().filter((key) => (value as Record<string, unknown>)[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function payloadHash(userId: string, payload: ActionPayload): string {
  return createHash("sha256").update(`${userId}\n${payload.type}\n${canonicalJson(payload)}`).digest("hex");
}

/** Same person + same exact change (on the same day) → same key → the existing proposal is returned. */
export function idempotencyKey(payload: ActionPayload, hash: string): string {
  const day = "date" in payload ? payload.date : "any";
  return `${payload.type}:${day}:${hash.slice(0, 24)}`;
}
