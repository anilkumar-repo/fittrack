/**
 * Water and comeback rules, shared by the app and the reminder server.
 *
 * Water is not a fixed "drink every hour" alarm. RozFit works out a daily target from body weight
 * (plus extra on workout days), compares what you've logged with where you should be by this time of
 * day, and only speaks up when you're clearly behind — at most every 3 hours, never at night.
 */

export const GLASS_ML = 250;
export const BOTTLE_ML = 500;
export const WATER_DAY = { startHour: 8, endHour: 21 } as const;

/** Daily water target in ml: 35 ml per kg (clamped 1.8–4 L), plus 500 ml on a workout day. Rounded to 50 ml. */
export function waterTargetMl(weightKg: number | null, workoutDay: boolean): number {
  const base = weightKg ? Math.min(4000, Math.max(1800, weightKg * 35)) : 2200;
  return Math.round((base + (workoutDay ? 500 : 0)) / 50) * 50;
}

/** How much should be in by this hour (straight line from 8:00 to 21:00). */
export function expectedByNow(targetMl: number, hour: number, minute = 0): number {
  const t = hour + minute / 60;
  const share = Math.min(1, Math.max(0, (t - WATER_DAY.startHour) / (WATER_DAY.endHour - WATER_DAY.startHour)));
  return Math.round(targetMl * share);
}

export type WaterMood = "great" | "on-track" | "behind" | "thirsty";

export function waterMood(loggedMl: number, targetMl: number, hour: number): WaterMood {
  if (loggedMl >= targetMl) return "great";
  const gap = expectedByNow(targetMl, hour) - loggedMl;
  if (gap <= targetMl * 0.1) return "on-track";
  return gap > targetMl * 0.3 ? "thirsty" : "behind";
}

const NUDGES = [
  (left: number) => `Rozi’s bottle is looking empty 🥤 ${left} ml to go today — one glass now?`,
  (left: number) => `Sip check! You’re a little behind. ${left} ml left for today.`,
  (left: number) => `Your muscles are 75% water 💧 Top up with a glass — ${left} ml to go.`,
  (left: number) => `Rozi brought you a glass 🧊 ${left} ml left to hit today’s goal.`,
];

export interface WaterNudgeInput {
  loggedMl: number;
  targetMl: number;
  hour: number;
  /** When the last water reminder was sent (ms), if ever. */
  lastSentAt: number | null;
  now: number;
  /** A workout was finished in the last 2 hours. */
  justTrained: boolean;
}

/** A water reminder to send now, or null. Only when behind pace, in the day, at most every 3 hours. */
export function waterNudge(input: WaterNudgeInput): { title: string; body: string } | null {
  if (input.hour < 10 || input.hour >= WATER_DAY.endHour) return null;
  if (input.loggedMl >= input.targetMl) return null;
  if (input.lastSentAt !== null && input.now - input.lastSentAt < 3 * 3_600_000) return null;
  const left = Math.max(0, input.targetMl - input.loggedMl);
  if (input.justTrained && left > 0) return { title: "Great workout! Now refuel 💧", body: `Drink a big glass after training — ${left} ml left for today.` };
  const mood = waterMood(input.loggedMl, input.targetMl, input.hour);
  if (mood !== "behind" && mood !== "thirsty") return null;
  return { title: mood === "thirsty" ? "Rozi is thirsty 🥵" : "Time for a glass of water 💧", body: NUDGES[(input.hour + Math.floor(left / 250)) % NUDGES.length](left) };
}

// ---------- Comeback reminders ----------

/** After this many days without a workout, RozFit sends a comeback reminder three times a day until the next session starts. */
export const COMEBACK_AFTER_DAYS = 5;
export const COMEBACK_HOURS = [9, 13, 19] as const;

export function comebackMessage(name: string, why: string, slot: number): { title: string; body: string } {
  const reason = why.trim();
  const reasonLine = reason ? `Remember why you started: “${reason}”.` : "Your plan is ready when you are.";
  const titles = [`Rozi misses you, ${name} 🧡`, "Just 10 minutes today?", "Your comeback starts now 💪"];
  const bodies = [`${reasonLine} A short session today restarts your streak.`, `${reasonLine} Even a gentle workout counts.`, `${reasonLine} Tap to start — Rozi will keep it easy.`];
  return { title: titles[slot % titles.length], body: bodies[slot % bodies.length] };
}

/** Which comeback slot (0, 1, 2) is due this hour, or null. */
export function comebackSlot(daysSinceWorkout: number | null, hour: number, workoutStartedToday: boolean): number | null {
  if (workoutStartedToday || daysSinceWorkout === null || daysSinceWorkout < COMEBACK_AFTER_DAYS) return null;
  const slot = COMEBACK_HOURS.indexOf(hour as (typeof COMEBACK_HOURS)[number]);
  return slot >= 0 ? slot : null;
}

export const WHY_OPTIONS = [
  "Feel healthier", "Lose weight", "Get stronger", "More energy", "Look and feel confident",
  "Manage stress", "Keep up with my kids/family", "Train for a sport or event", "Recover from an injury",
] as const;
