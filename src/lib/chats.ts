import { shiftDate } from "./dates.ts";
import { getExerciseDefinition } from "./templates.ts";
import type { RoziMood } from "./rozi.ts";
import type { WorkoutSession } from "./types";

// ---------- Chats (Phase 7 step A) ----------

/** Longest text message (the database refuses longer). */
export const MESSAGE_MAX = 2000;

/** The Rozi faces you can send as stickers (the database accepts exactly these). */
export const STICKERS: Array<{ mood: RoziMood; label: string }> = [
  { mood: "cheer", label: "Let's go!" }, { mood: "chat-hello", label: "Hi!" }, { mood: "workout", label: "Training" },
  { mood: "personal-record", label: "New PR" }, { mood: "trophy", label: "Champion" }, { mood: "milestone", label: "Milestone" },
  { mood: "energy-5", label: "Full of energy" }, { mood: "energy-1", label: "So tired" }, { mood: "streak-risk", label: "Don't break the streak" },
  { mood: "comeback", label: "I'm back" }, { mood: "grumpy", label: "Grumpy" }, { mood: "care", label: "Take care" },
  { mood: "rest", label: "Rest day" }, { mood: "water", label: "Drink water" }, { mood: "chat-idea", label: "Idea" }, { mood: "done-day", label: "Done for today" },
];
const STICKER_MOODS = new Set<string>(STICKERS.map((sticker) => sticker.mood));
export const isSticker = (mood: unknown): mood is RoziMood => typeof mood === "string" && STICKER_MOODS.has(mood);

export type MessageKind = "text" | "sticker" | "workout";

/** The "share my workout" card sent into a chat. */
export interface WorkoutCard {
  title: string;
  date: string;
  durationMinutes?: number;
  totalSets: number;
  exercises: Array<{ name: string; sets: number; reps: string; topKg?: number }>;
  /** Exercises where this workout beat your best weight before it. */
  prs: string[];
}

const MAX_CARD_EXERCISES = 12;

/**
 * The card for a finished workout: each exercise with its completed working sets (warm-ups left out), the rep range
 * and the heaviest weight, the total sets, and new personal bests (only when you'd lifted that exercise before).
 * Null when the workout isn't finished or has no completed sets.
 */
export function workoutCard(session: WorkoutSession, history: WorkoutSession[]): WorkoutCard | null {
  if (session.status !== "completed") return null;
  const bestBefore = new Map<string, number>();
  for (const earlier of history) {
    if (earlier.status !== "completed" || earlier.date >= session.date) continue;
    for (const log of earlier.exerciseLogs) {
      for (const set of log.sets) {
        if (set.completed && typeof set.loadKg === "number" && set.loadKg > (bestBefore.get(log.exerciseId) ?? 0)) bestBefore.set(log.exerciseId, set.loadKg);
      }
    }
  }
  const exercises: WorkoutCard["exercises"] = [];
  const prs: string[] = [];
  for (const log of session.exerciseLogs) {
    const done = log.sets.filter((set) => set.completed && set.kind !== "warmup");
    if (!done.length) continue;
    const name = log.substitutionName || session.plan.exercises.find((exercise) => exercise.id === log.exerciseId)?.name || getExerciseDefinition(log.exerciseId)?.name || "Exercise";
    const reps = done.map((set) => set.actualReps).filter((value): value is number => typeof value === "number" && value > 0);
    const loads = done.map((set) => set.loadKg).filter((value): value is number => typeof value === "number" && value > 0);
    const topKg = loads.length ? Math.max(...loads) : undefined;
    const low = reps.length ? Math.min(...reps) : null;
    const high = reps.length ? Math.max(...reps) : null;
    exercises.push({ name, sets: done.length, reps: low === null ? "" : low === high ? String(low) : `${low}–${high}`, ...(topKg ? { topKg } : {}) });
    const before = bestBefore.get(log.exerciseId);
    if (topKg && before && topKg > before) prs.push(name);
  }
  if (!exercises.length) return null;
  return {
    title: session.plan.title.slice(0, 80),
    date: session.date,
    ...(session.plan.durationMinutes ? { durationMinutes: session.plan.durationMinutes } : {}),
    totalSets: exercises.reduce((sum, exercise) => sum + exercise.sets, 0),
    exercises: exercises.slice(0, MAX_CARD_EXERCISES),
    prs,
  };
}

/** A card read back from a message (anything malformed is dropped rather than shown wrong). */
export function readWorkoutCard(payload: unknown): WorkoutCard | null {
  if (!payload || typeof payload !== "object") return null;
  const row = payload as Record<string, unknown>;
  if (typeof row.title !== "string" || !Array.isArray(row.exercises)) return null;
  return {
    title: row.title, date: typeof row.date === "string" ? row.date : "",
    ...(typeof row.durationMinutes === "number" ? { durationMinutes: row.durationMinutes } : {}),
    totalSets: typeof row.totalSets === "number" ? row.totalSets : 0,
    exercises: row.exercises.slice(0, MAX_CARD_EXERCISES).filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object").map((item) => ({
      name: String(item.name ?? "Exercise"), sets: Number(item.sets ?? 0), reps: String(item.reps ?? ""),
      ...(typeof item.topKg === "number" ? { topKg: item.topKg } : {}),
    })),
    prs: Array.isArray(row.prs) ? row.prs.map(String) : [],
  };
}

/** One line for the chat list: "You: See you at 7", "Ravi: Sticker", "Shared a workout: Push B", "Message deleted". */
export function messagePreview(last: { kind: string; body: string; title?: string | null; senderId: string; deleted: boolean } | null, me: string, senderName?: string): string {
  if (!last) return "Say hi 👋";
  const who = last.senderId === me ? "You: " : senderName ? `${senderName.split(" ")[0]}: ` : "";
  if (last.deleted) return `${who}Message deleted`;
  if (last.kind === "sticker") return `${who}Sent a sticker`;
  if (last.kind === "workout") return `${who}Shared a workout${last.title ? `: ${last.title}` : ""}`;
  return `${who}${last.body.replace(/\s+/g, " ").trim()}`;
}

/** The calendar day (YYYY-MM-DD) a message was sent, on this phone's clock. */
export function localDay(iso: string): string {
  const at = new Date(iso);
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`;
}

/** The divider above a day's messages: "Today", "Yesterday", or a date. */
export function dayLabel(date: string, today: string): string {
  if (date === today) return "Today";
  if (date === shiftDate(today, -1)) return "Yesterday";
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day, 12));
  return value.toLocaleDateString("en", { weekday: date >= shiftDate(today, -6) ? "long" : undefined, month: "short", day: "numeric", year: year === Number(today.slice(0, 4)) ? undefined : "numeric", timeZone: "UTC" });
}

/** Messages in a row from the same person within 5 minutes share one name and picture. */
export function startsGroup(previous: { senderId: string; at: string } | undefined, current: { senderId: string; at: string }): boolean {
  if (!previous || previous.senderId !== current.senderId) return true;
  return Date.parse(current.at) - Date.parse(previous.at) > 5 * 60_000;
}

/** What to do with a typed message: send it, or why not. */
export function textProblem(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return "Write a message first.";
  if (trimmed.length > MESSAGE_MAX) return `Keep it under ${MESSAGE_MAX.toLocaleString("en")} characters.`;
  return null;
}
