import { shiftDate, weekdayOf } from "./dates.ts";

// ---------- What a trainer may see (per trainer, chosen by the client) ----------

export type ShareKey = "workouts" | "body" | "checkins" | "missed";
export type TrainerShares = Record<ShareKey, boolean>;

/** New links: workouts on, everything else off until the client turns it on. */
export const DEFAULT_TRAINER_SHARES: TrainerShares = { workouts: true, body: false, checkins: false, missed: false };

export const SHARE_OPTIONS: Array<{ key: ShareKey; label: string; note: string }> = [
  { key: "workouts", label: "Workouts", note: "Days trained, exercises, sets and weights, streak" },
  { key: "body", label: "Body", note: "Height, age and body weight" },
  { key: "checkins", label: "How you feel", note: "Energy, soreness, pain and notes from check-ins" },
  { key: "missed", label: "Missed days", note: "Why a workout was missed" },
];

/** Sharing settings from the database, field by field; anything missing or odd falls back to the default. */
export function readShares(value: unknown): TrainerShares {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return {
    workouts: typeof source.workouts === "boolean" ? source.workouts : DEFAULT_TRAINER_SHARES.workouts,
    body: typeof source.body === "boolean" ? source.body : DEFAULT_TRAINER_SHARES.body,
    checkins: typeof source.checkins === "boolean" ? source.checkins : DEFAULT_TRAINER_SHARES.checkins,
    missed: typeof source.missed === "boolean" ? source.missed : DEFAULT_TRAINER_SHARES.missed,
  };
}

// ---------- Joining with a trainer's QR code ----------

const CODE = /^[A-Z2-9]{8}$/;

/** The address a gym QR code opens: https://…/join/ABCD2345. */
export function joinLink(origin: string, code: string): string {
  return `${origin.replace(/\/+$/, "")}/join/${code}`;
}

/** The trainer code in a join address (or a typed code), or null. */
export function joinCode(value: string): string | null {
  const code = decodeURIComponent(value.trim().split("/").filter(Boolean).at(-1) ?? "").toUpperCase();
  return CODE.test(code) ? code : null;
}

// ---------- Trainer dashboard: one card per client ----------

/** One day of a client's training, as the trainer may see it (fields the client doesn't share are missing). */
export interface ClientDay {
  date: string;
  status: string;
  energy?: number | null;
  soreness?: number | null;
  pain?: boolean | null;
  missedReason?: string | null;
}

export type ClientFlag = "pain" | "inactive" | "missed" | "sore" | "low-energy";

export const FLAG_LABELS: Record<ClientFlag, string> = {
  pain: "Reported pain",
  inactive: "No workout for a week",
  missed: "Missed planned days",
  sore: "Very sore",
  "low-energy": "Low energy",
};

export interface ClientSummary {
  /** Planned training days completed in a row (today counts once it's done). */
  streak: number;
  lastWorkout: string | null;
  weekDone: number;
  weekGoal: number;
  flags: ClientFlag[];
}

interface Plan { trainingDays: number[]; trainingStartDate: string; sessionsPerWeek: number }

const done = (day: ClientDay | undefined) => day?.status === "completed";

function mondayOf(date: string): string {
  return shiftDate(date, -((weekdayOf(date) + 6) % 7));
}

/**
 * The numbers and warnings on a client's card. Flags, most serious first: pain in the last 7 days, no workout for
 * 7+ days (once they've been training a week), 2+ planned days missed in the last 7, soreness 4–5 in the last 3 days,
 * energy 1–2 at the last two check-ins. Pain, soreness and energy only show if the client shares check-ins.
 */
export function clientSummary(plan: Plan, days: ClientDay[], today: string): ClientSummary {
  const byDate = new Map(days.map((day) => [day.date, day]));
  const isTrainingDay = (date: string) => date >= plan.trainingStartDate && plan.trainingDays.includes(weekdayOf(date));

  // Streak: walk back over planned days; today only counts once done (an unfinished today doesn't break it).
  let streak = 0;
  for (let date = today, steps = 0; date >= plan.trainingStartDate && steps < 400; date = shiftDate(date, -1), steps++) {
    if (!isTrainingDay(date)) continue;
    if (done(byDate.get(date))) streak++;
    else if (date !== today) break;
  }

  const completed = days.filter(done).map((day) => day.date).filter((date) => date <= today).sort();
  const lastWorkout = completed.at(-1) ?? null;
  const monday = mondayOf(today);
  const weekDone = completed.filter((date) => date >= monday).length;

  const flags: ClientFlag[] = [];
  const within = (n: number) => (day: ClientDay) => day.date <= today && day.date > shiftDate(today, -n);
  if (days.some((day) => within(7)(day) && day.pain === true)) flags.push("pain");
  const trainingForAWeek = plan.trainingStartDate <= shiftDate(today, -7);
  if (trainingForAWeek && (!lastWorkout || lastWorkout <= shiftDate(today, -7))) flags.push("inactive");
  let missed = 0;
  for (let i = 1; i <= 7; i++) {
    const date = shiftDate(today, -i);
    if (isTrainingDay(date) && !done(byDate.get(date))) missed++;
  }
  if (missed >= 2 && !flags.includes("inactive")) flags.push("missed");
  if (days.some((day) => within(3)(day) && typeof day.soreness === "number" && day.soreness >= 4)) flags.push("sore");
  const energies = days.filter((day) => day.date <= today && typeof day.energy === "number").sort((a, b) => a.date.localeCompare(b.date)).slice(-2);
  if (energies.length === 2 && energies.every((day) => (day.energy as number) <= 2)) flags.push("low-energy");

  return { streak, lastWorkout, weekDone, weekGoal: Math.min(7, Math.max(1, plan.sessionsPerWeek)), flags };
}

/** Clients who need a look first (most serious flag), then everyone else by name. */
export function sortForAttention<T extends { name: string; summary: ClientSummary }>(clients: T[]): T[] {
  const order: ClientFlag[] = ["pain", "inactive", "missed", "sore", "low-energy"];
  const rank = (client: T) => client.summary.flags.length ? order.indexOf(client.summary.flags[0]) : order.length;
  return [...clients].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

// ---------- Broadcasts ----------

export const BROADCAST_MAX = 500;

/** Why a broadcast can't be sent yet, or null when it's fine. */
export function broadcastProblem(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return "Write a message first.";
  if (trimmed.length > BROADCAST_MAX) return `Keep it under ${BROADCAST_MAX} characters.`;
  return null;
}

/** Phone storage key for a gym QR code opened before the person had set up RozFit (picked up after sign-in). */
export const PENDING_JOIN_KEY = "rozfit-join-code";

// ---------- Self-serve trainers ----------

/** Most active clients one trainer can have (also enforced by the database). */
export const MAX_CLIENTS = 25;
export const BIO_MAX = 280;
export const MAX_SPECIALTIES = 6;
/** Quick picks for a trainer's specialities; they can type their own too. */
export const SPECIALTY_SUGGESTIONS = ["Strength", "Weight loss", "Muscle gain", "Beginners", "Mobility", "Yoga", "Cardio", "HIIT", "Women's fitness", "Seniors", "Sports", "Posture"];

export const REPORT_REASONS: Array<{ id: "unsafe" | "inappropriate" | "spam" | "fake" | "other"; label: string }> = [
  { id: "unsafe", label: "Unsafe advice" },
  { id: "inappropriate", label: "Inappropriate behaviour" },
  { id: "spam", label: "Spam or selling" },
  { id: "fake", label: "Pretending to be someone" },
  { id: "other", label: "Something else" },
];

/** Cleans a speciality list: trimmed, no duplicates (any case), up to 6, each at most 30 characters. */
export function cleanSpecialties(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const value = item.trim().slice(0, 30);
    if (!value || seen.has(value.toLowerCase())) continue;
    seen.add(value.toLowerCase());
    out.push(value);
    if (out.length === MAX_SPECIALTIES) break;
  }
  return out;
}
