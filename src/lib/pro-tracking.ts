import { getExerciseDefinition, RULE_VERSION, TEMPLATE_VERSION } from "./templates.ts";
import type { ExerciseDefinition, ExerciseLog, WorkoutPlan, WorkoutSession } from "./types";

/** Phase 4 (2026-11-17): set types, strength estimates, plates, warm-ups, exercise history and your own routines. */
export type SetKind = "normal" | "warmup" | "drop" | "failure";
type SetLog = ExerciseLog["sets"][number];
export const SET_KINDS: Array<{ id: SetKind; letter: string; label: string; note: string }> = [
  { id: "normal", letter: "1", label: "Working set", note: "Counts toward your records" },
  { id: "warmup", letter: "W", label: "Warm-up", note: "Lighter; not counted in records" },
  { id: "drop", letter: "D", label: "Drop set", note: "Straight after, with less weight" },
  { id: "failure", letter: "F", label: "To failure", note: "As many good reps as you can" },
];

export function setKind(set: Pick<SetLog, "kind">): SetKind {
  return set.kind ?? "normal";
}

/** The label in the SET column: W / D / F, and working sets numbered 1, 2, 3 among themselves. */
export function setLabels(sets: Array<Pick<SetLog, "kind">>): string[] {
  let n = 0;
  return sets.map((set) => {
    const kind = setKind(set);
    if (kind === "warmup") return "W";
    if (kind === "drop") return "D";
    if (kind === "failure") return "F";
    n += 1;
    return String(n);
  });
}

/** Estimated one-rep max (Epley). Only from 1–12 reps, where the estimate is reasonable. */
export function estimateOneRepMax(loadKg: number, reps: number): number | null {
  if (!(loadKg > 0) || !Number.isInteger(reps) || reps < 1 || reps > 12) return null;
  return Math.round((reps === 1 ? loadKg : loadKg * (1 + reps / 30)) * 10) / 10;
}

/** What you could probably lift for 1–10 reps, from an estimated one-rep max. */
export function repMaxTable(oneRepMax: number): Array<{ reps: number; loadKg: number }> {
  return Array.from({ length: 10 }, (_, i) => ({ reps: i + 1, loadKg: Math.round((i === 0 ? oneRepMax : oneRepMax / (1 + (i + 1) / 30)) * 2) / 2 }));
}

export const STANDARD_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];

/** Plates for each side of the bar to reach `targetKg` (20 kg bar by default), largest first. */
export function platesPerSide(targetKg: number, barKg = 20, plates = STANDARD_PLATES_KG): { perSide: number[]; totalKg: number; shortKg: number } {
  let side = Math.max(0, (targetKg - barKg) / 2);
  const perSide: number[] = [];
  for (const plate of plates) {
    while (side >= plate - 1e-9) { perSide.push(plate); side = Math.round((side - plate) * 1000) / 1000; }
  }
  const totalKg = Math.round((barKg + perSide.reduce((a, b) => a + b, 0) * 2) * 100) / 100;
  return { perSide, totalKg, shortKg: Math.round((targetKg - totalKg) * 100) / 100 };
}

/** Warm-up sets before a working weight: about 40 % × 10, 60 % × 6 and 80 % × 3, rounded to 2.5 kg. */
export function warmUpSets(workKg: number, minKg = 0): Array<{ loadKg: number; reps: number; percent: number }> {
  if (!(workKg > 0)) return [];
  const steps = [[40, 10], [60, 6], [80, 3]] as const;
  const out: Array<{ loadKg: number; reps: number; percent: number }> = [];
  for (const [percent, reps] of steps) {
    const loadKg = Math.max(minKg, Math.round((workKg * percent) / 100 / 2.5) * 2.5);
    if (loadKg < workKg && !out.some((set) => set.loadKg === loadKg)) out.push({ loadKg, reps, percent });
  }
  return out;
}

export interface ExerciseDay {
  date: string;
  sets: Array<{ reps: number; loadKg: number | null; kind: SetKind; oneRepMax: number | null }>;
  /** Heaviest working set that day. */
  best: { reps: number; loadKg: number } | null;
  volumeKg: number;
  oneRepMax: number | null;
}

/** Every saved session with completed sets of this exercise, newest first. Warm-ups are listed but never counted. */
export function exerciseHistory(sessions: WorkoutSession[], exerciseId: string): ExerciseDay[] {
  const days: ExerciseDay[] = [];
  for (const session of sessions) {
    if (session.sampleData || (session.status !== "completed" && session.status !== "in_progress")) continue;
    const log = session.exerciseLogs.find((item) => item.exerciseId === exerciseId);
    const sets = (log?.sets ?? []).filter((set) => set.completed && typeof set.actualReps === "number" && set.actualReps > 0)
      .map((set) => ({ reps: set.actualReps as number, loadKg: set.loadKg, kind: setKind(set), oneRepMax: set.loadKg && setKind(set) !== "warmup" ? estimateOneRepMax(set.loadKg, set.actualReps as number) : null }));
    if (!sets.length) continue;
    const working = sets.filter((set) => set.kind !== "warmup" && set.loadKg && set.loadKg > 0) as Array<{ reps: number; loadKg: number; kind: SetKind; oneRepMax: number | null }>;
    const best = working.reduce<{ reps: number; loadKg: number } | null>((top, set) => !top || set.loadKg > top.loadKg || (set.loadKg === top.loadKg && set.reps > top.reps) ? { reps: set.reps, loadKg: set.loadKg } : top, null);
    const oneRepMaxes = working.map((set) => set.oneRepMax).filter((value): value is number => value !== null);
    days.push({
      date: session.date, sets, best,
      volumeKg: Math.round(working.reduce((sum, set) => sum + set.reps * set.loadKg, 0)),
      oneRepMax: oneRepMaxes.length ? Math.max(...oneRepMaxes) : null,
    });
  }
  return days.sort((a, b) => b.date.localeCompare(a.date));
}

export interface ExerciseRecords {
  heaviest: { loadKg: number; reps: number; date: string } | null;
  bestOneRepMax: { value: number; date: string } | null;
  bestVolume: { volumeKg: number; date: string } | null;
  mostReps: { reps: number; loadKg: number | null; date: string } | null;
  sessions: number;
}

export function exerciseRecords(history: ExerciseDay[]): ExerciseRecords {
  const records: ExerciseRecords = { heaviest: null, bestOneRepMax: null, bestVolume: null, mostReps: null, sessions: history.length };
  for (const day of history) {
    if (day.best && (!records.heaviest || day.best.loadKg > records.heaviest.loadKg)) records.heaviest = { ...day.best, date: day.date };
    if (day.oneRepMax && (!records.bestOneRepMax || day.oneRepMax > records.bestOneRepMax.value)) records.bestOneRepMax = { value: day.oneRepMax, date: day.date };
    if (day.volumeKg && (!records.bestVolume || day.volumeKg > records.bestVolume.volumeKg)) records.bestVolume = { volumeKg: day.volumeKg, date: day.date };
    for (const set of day.sets) if (set.kind !== "warmup" && (!records.mostReps || set.reps > records.mostReps.reps)) records.mostReps = { reps: set.reps, loadKg: set.loadKg, date: day.date };
  }
  return records;
}

/** A routine you build yourself: exercises with sets and reps. */
export interface Routine {
  id: string;
  name: string;
  exercises: Array<{ exerciseId: string; sets: number; reps: string }>;
  updatedAt: string;
}

export function validateRoutine(routine: Pick<Routine, "name" | "exercises">): string[] {
  const errors: string[] = [];
  if (!routine.name.trim()) errors.push("Give your routine a name.");
  if (routine.name.trim().length > 60) errors.push("Keep the name under 60 characters.");
  if (!routine.exercises.length) errors.push("Add at least one exercise.");
  if (routine.exercises.length > 20) errors.push("Up to 20 exercises.");
  for (const item of routine.exercises) {
    if (!getExerciseDefinition(item.exerciseId)) errors.push("One exercise is no longer in the library.");
    if (!Number.isInteger(item.sets) || item.sets < 1 || item.sets > 10) errors.push("Sets must be 1–10.");
    if (!/^\d{1,2}(–\d{1,2})?$/.test(item.reps)) errors.push("Reps look like 8 or 8–12.");
  }
  return [...new Set(errors)];
}

/** Today's plan from a routine, in the same shape the planner makes (so logging, history and records just work). */
export function routinePlan(routine: Routine, date: string): WorkoutPlan {
  const exercises: ExerciseDefinition[] = routine.exercises.flatMap((item) => {
    const definition = getExerciseDefinition(item.exerciseId);
    return definition ? [{ ...definition, sets: item.sets, reps: item.reps, manualOverride: true, selectionReason: `Part of your routine “${routine.name}”.` }] : [];
  });
  const sets = exercises.reduce((sum, exercise) => sum + exercise.sets, 0);
  return {
    id: `${date}-routine-${routine.id}`, date, focus: "Your routine", title: routine.name,
    description: "Your own routine. Rozi still tracks your sets, rest, history and records.",
    durationMinutes: Math.max(10, Math.round((sets * 2.5) / 5) * 5),
    exercises, isReturnSession: false, sessionNumber: 0, templateVersion: TEMPLATE_VERSION, ruleVersion: RULE_VERSION,
    phase: "foundation_2", sessionType: "training", sourceExerciseIds: exercises.map((exercise) => exercise.id),
    originalExercises: exercises.map((exercise) => ({ id: exercise.id, name: exercise.name, sets: exercise.sets, reps: exercise.reps, equipment: exercise.equipment })),
    generationReasons: [`You built this routine (“${routine.name}”). Pain in a check-in still switches the day to recovery.`],
  };
}
