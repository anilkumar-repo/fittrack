// ---------- Rozi AI: per-person rate limit ----------
//
// Best effort, kept in the server's memory: it protects the shared AI quota from one person (or a stuck client)
// sending many questions. Each server instance counts separately and counts reset on a restart, so this is a guard,
// not billing. A database-backed daily count comes with chat history (Stage 6).

export interface RateLimitRule { limit: number; windowMs: number }

export const ROZI_RATE_LIMITS: RateLimitRule[] = [
  { limit: 6, windowMs: 60_000 },          // 6 questions a minute
  { limit: 60, windowMs: 24 * 3_600_000 }, // 60 a day
];

/**
 * DEGRADED fallback, used only when the database limit isn't available (migration missing or a database error).
 * Kept in each server instance's memory — Vercel may run several, so this is weaker protection than the database
 * limit and is stricter to compensate.
 */
export const DEGRADED_RATE_LIMITS: RateLimitRule[] = [
  { limit: 3, windowMs: 60_000 },          // 3 questions a minute
  { limit: 20, windowMs: 24 * 3_600_000 }, // 20 a day
];

export type RateDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export interface RateLimiter {
  /** Records one question for `key` if allowed. */
  take(key: string, now?: number): RateDecision;
}

export function createRateLimiter(rules: RateLimitRule[] = ROZI_RATE_LIMITS, maxKeys = 10_000): RateLimiter {
  const longest = Math.max(...rules.map((rule) => rule.windowMs));
  const hits = new Map<string, number[]>();
  return {
    take(key, now = Date.now()) {
      const recent = (hits.get(key) ?? []).filter((time) => now - time < longest);
      for (const rule of rules) {
        const inWindow = recent.filter((time) => now - time < rule.windowMs);
        if (inWindow.length >= rule.limit) {
          return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((inWindow[0] + rule.windowMs - now) / 1000)) };
        }
      }
      recent.push(now);
      hits.delete(key);
      hits.set(key, recent);
      // Forget the least recently active people if the map grows too big.
      while (hits.size > maxKeys) hits.delete(hits.keys().next().value as string);
      return { allowed: true };
    },
  };
}
