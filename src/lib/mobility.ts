import { MOBILITY_MOVES, MOBILITY_ROUTINES, type MobilityArea, type MobilityMove, type MobilityRoutine } from "./mobility-data.ts";

export { MOBILITY_MOVES, MOBILITY_ROUTINES };
export type { MobilityArea, MobilityMove, MobilityRoutine };

export const AREA_LABELS: Record<MobilityArea, string> = {
  neck: "Neck & upper back", shoulders: "Shoulders & chest", arms: "Arms & wrists", spine: "Spine & back", breathing: "Breathing",
  core: "Core & posture", hips: "Hips & inner thighs", legs: "Legs & ankles", strength: "Hip & leg strength", knee: "Knee care", landing: "Jump & landing",
};

const BY_ID = new Map(MOBILITY_MOVES.map((move) => [move.id, move]));

export function mobilityMove(id: string): MobilityMove | undefined {
  return BY_ID.get(id);
}

export function mobilityRoutine(id: string): MobilityRoutine | undefined {
  return MOBILITY_ROUTINES.find((routine) => routine.id === id);
}

export function stretchPicture(id: string): string {
  return `/stretches/v1/${id}.webp`;
}

/** "40 s", "10 reps", "5 slow breaths" (+ "each side"). */
export function doseLabel(move: MobilityMove): string {
  const base = move.kind === "hold" ? `${move.amount} s` : move.kind === "reps" ? `${move.amount} reps` : `${move.amount} slow breaths`;
  return move.sides ? `${base} each side` : base;
}

/** Seconds for one side of a move (reps ≈ 3 s each, a slow breath ≈ 8 s). */
export function sideSeconds(move: MobilityMove): number {
  return move.kind === "hold" ? move.amount : move.kind === "reps" ? move.amount * 3 : move.amount * 8;
}

/** One step of the guided player: a move, and which side (if it has sides). */
export interface PlayerStep { move: MobilityMove; side: "left" | "right" | null }

export function routineSteps(routine: MobilityRoutine): PlayerStep[] {
  return routine.moves.flatMap((id): PlayerStep[] => {
    const move = BY_ID.get(id);
    if (!move) return [];
    return move.sides ? [{ move, side: "left" }, { move, side: "right" }] : [{ move, side: null }];
  });
}

/** Whole minutes, counting 8 s to get into each position. */
export function routineMinutes(routine: MobilityRoutine): number {
  const seconds = routineSteps(routine).reduce((sum, step) => sum + sideSeconds(step.move) + 8, 0);
  return Math.max(1, Math.round(seconds / 60));
}

// ---------- Suggestions ----------

/** Warm-up for a workout, from its focus/title (lower body, pull/back, push/upper, or full body). */
export function warmUpFor(focus: string): MobilityRoutine {
  const text = focus.toLowerCase();
  const id = /lower|leg|squat|glute|quad/.test(text) ? "before-leg-day"
    : /pull|back|row/.test(text) ? "back-day-mobility"
      : /push|upper|chest|shoulder|arm/.test(text) ? "upper-body-mobility"
        : "morning-wake-up";
  return mobilityRoutine(id) as MobilityRoutine;
}

/** A short version of a routine (its first 5 moves), for a warm-up that doesn't eat into the workout. */
export function quickVersion(routine: MobilityRoutine): MobilityRoutine {
  return { ...routine, id: routine.id, title: `${routine.title} (quick)`, moves: routine.moves.slice(0, 5) };
}

/** Cool-down after a workout: arms after push/arm days, otherwise the full-body cool-down. */
export function coolDownFor(focus: string): MobilityRoutine {
  return mobilityRoutine(/push|arm|tricep/.test(focus.toLowerCase()) ? "triceps-and-arms-stretch" : "full-body-cool-down") as MobilityRoutine;
}

export interface DaySuggestionInput {
  hour: number;
  restDay: boolean;
  /** Most recent missed-day reason within the last 3 days, if any. */
  recentMissedReason?: string | null;
  /** The last workout reported discomfort or pain. */
  discomfort?: boolean;
}

/** "Mobility of the day" on Home: knee/pain care first, then travel, soreness, rest-day and evening picks. */
export function suggestionForDay(input: DaySuggestionInput): { routine: MobilityRoutine; reason: string } | null {
  const pick = (id: string, reason: string) => ({ routine: mobilityRoutine(id) as MobilityRoutine, reason });
  if (input.discomfort) return pick("knee-care", "Your last workout noted discomfort — gentle moves help. Stop anything that hurts.");
  if (input.recentMissedReason === "travel") return pick("desk-and-travel-stretch", "Travelling? These work in a seat or hotel room.");
  if (input.recentMissedReason === "sore" || input.recentMissedReason === "unwell") return pick("breathing-and-ribs", "Feeling sore or run-down? Breathe and loosen up gently.");
  if (input.restDay) return input.hour < 14 ? pick("morning-wake-up", "Rest day — a few minutes of mobility keeps you loose.") : pick("posture-and-pelvis-reset", "Rest day — undo a day of sitting.");
  if (input.hour >= 20) return pick("breathing-and-ribs", "Wind down before bed.");
  return null;
}

// ---------- Done today (kept on this device) ----------

const DONE_KEY = "rozfit-mobility-done";

export function markRoutineDone(routineId: string, date: string): void {
  try {
    const raw = window.localStorage.getItem(DONE_KEY);
    const map = raw ? JSON.parse(raw) as Record<string, string[]> : {};
    map[date] = [...new Set([...(map[date] ?? []), routineId])];
    // Keep the last 60 days only.
    const keep = Object.keys(map).sort().slice(-60);
    window.localStorage.setItem(DONE_KEY, JSON.stringify(Object.fromEntries(keep.map((key) => [key, map[key]]))));
  } catch { /* not remembered on this device */ }
}

export function routinesDoneOn(date: string): string[] {
  try { const raw = window.localStorage.getItem(DONE_KEY); return raw ? (JSON.parse(raw) as Record<string, string[]>)[date] ?? [] : []; } catch { return []; }
}
