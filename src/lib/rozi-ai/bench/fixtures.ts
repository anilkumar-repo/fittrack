// ---------- Rozi AI benchmark: made-up sample accounts ----------
//
// Four invented accounts on a FIXED date, so every expected answer is known and never drifts. Nothing here comes from
// a real account. The facts each question is checked against are read through the real tools (runRoziTool), so the
// benchmark never re-implements workout, progress or recovery calculations.

import { createDemoState } from "../../demo-data.ts";
import { shiftDate, weekdayOf } from "../../dates.ts";
import { getExerciseDefinition } from "../../templates.ts";
import type { BodyWeightEntry, CheckIn, Profile, WorkoutReview, WorkoutSession } from "../../types";
import { roziContext, type RoziContext } from "../tools.ts";

/** A Wednesday. Training days in the samples are Monday, Wednesday and Friday. */
export const BENCH_TODAY = "2026-11-18";
export const BENCH_HOUR = 10;

export type SampleId = "regular" | "newbie" | "mixed" | "restricted";

type Move = [exerciseId: string, sets: number, kg: number | null];

interface SessionOptions {
  status?: WorkoutSession["status"];
  /** For "in_progress": how many sets of the first move are done so far. */
  setsDone?: number;
  review?: Partial<WorkoutReview>;
  checkIn?: Partial<CheckIn>;
  title?: string;
}

function session(date: string, moves: Move[], options: SessionOptions = {}): WorkoutSession {
  const status = options.status ?? "completed";
  const doneSets = (index: number, sets: number) => status === "completed" ? sets : status === "in_progress" && index === 0 ? Math.min(sets, options.setsDone ?? 0) : 0;
  return {
    id: `bench-${date}`, date, status,
    plan: { title: options.title ?? "Strength day", focus: "Foundation A", durationMinutes: 45, exercises: moves.map(([id]) => getExerciseDefinition(id)!), generationReasons: ["Your Monday–Wednesday–Friday plan."] },
    exerciseLogs: moves.map(([id, sets, kg], index) => {
      const done = doneSets(index, sets);
      return {
        exerciseId: id, plannedSets: sets, plannedReps: 8, status: status === "skipped" ? "skipped" : done === sets ? "completed" : done > 0 ? "partial" : "pending",
        substitutionName: "", formQuality: "sound", notes: "",
        sets: Array.from({ length: sets }, (_, set) => ({ plannedReps: 8, actualReps: set < done ? 8 : null, loadKg: kg, completed: set < done, extra: false })),
      };
    }),
    ...(options.review ? { review: { effort: 6, mood: "same", energyAfter: 3, discomfort: false, discomfortNote: "", note: "", ...options.review } } : {}),
    ...(options.checkIn ? { checkIn: { energy: 3, soreness: 2, pain: false, recovery: 3, discomfort: "", note: "", ...options.checkIn } } : {}),
  } as unknown as WorkoutSession;
}

const weight = (daysBack: number, kg: number): BodyWeightEntry => ({ id: `w-${daysBack}`, measuredOn: shiftDate(BENCH_TODAY, -daysBack), weightKg: kg }) as BodyWeightEntry;

const baseProfile = (patch: Partial<Profile>): Profile => ({
  ...createDemoState().profile, id: "bench-user", displayName: "Bench Sample", trainingDays: [1, 3, 5], sessionsPerWeek: 3,
  preferredSessionMinutes: 45, timeZone: "Asia/Kolkata", ...patch,
});

/** ~10 weeks of Mon/Wed/Fri before today; squat climbs most (50 → 65 kg), bench +5, pulldown +5; one skipped day. */
function regularSessions(): WorkoutSession[] {
  const sessions: WorkoutSession[] = [];
  let index = 0;
  for (let back = 70; back >= 1; back--) {
    const date = shiftDate(BENCH_TODAY, -back);
    if (![1, 3, 5].includes(weekdayOf(date))) continue;
    const step = Math.floor(index / 3);
    const kind = index % 3;
    if (back === 12) sessions.push(session(date, [["back_squat", 3, null]], { status: "skipped" }));
    else if (kind === 0) sessions.push(session(date, [["barbell_bench", 3, Math.min(45, 40 + step * 0.5)], ["lat_pulldown", 3, Math.min(40, 35 + step * 0.5)]], { title: "Upper A" }));
    else if (kind === 1) sessions.push(session(date, [["back_squat", 3, Math.min(65, 50 + step * 1.5)], ["machine_shoulder_press", 3, 20]], { title: "Legs & shoulders" }));
    else sessions.push(session(date, [["barbell_bench", 3, Math.min(45, 40 + step * 0.5)], ["seated_row", 3, 30]], { title: "Upper B" }));
    index++;
  }
  return sessions;
}

/** Three weeks with a skipped day, a partly done day, sore legs yesterday, and today's workout started but not finished. */
function mixedSessions(): WorkoutSession[] {
  return [
    session(shiftDate(BENCH_TODAY, -16), [["goblet_squat", 3, 16], ["dumbbell_bench", 3, 14]]),
    session(shiftDate(BENCH_TODAY, -14), [["lat_pulldown", 3, 30]], { status: "skipped" }),
    session(shiftDate(BENCH_TODAY, -12), [["goblet_squat", 3, 18], ["seated_row", 3, 25]]),
    session(shiftDate(BENCH_TODAY, -9), [["dumbbell_bench", 3, 16]], { status: "skipped" }),
    session(shiftDate(BENCH_TODAY, -7), [["goblet_squat", 3, 18], ["lat_pulldown", 3, 30]], { status: "in_progress", setsDone: 2 }),
    session(shiftDate(BENCH_TODAY, -5), [["dumbbell_bench", 3, 16], ["seated_row", 3, 25]]),
    session(shiftDate(BENCH_TODAY, -1), [["goblet_squat", 3, 20], ["reverse_lunge", 3, 10]], { review: { discomfort: true, discomfortNote: "legs very sore" }, checkIn: { soreness: 5 } }),
    session(BENCH_TODAY, [["dumbbell_bench", 3, 16], ["seated_row", 3, 25]], { status: "in_progress", setsDone: 1, title: "Upper day" }),
  ];
}

export const SAMPLES: Record<SampleId, { label: string; profile: Profile; sessions: () => WorkoutSession[]; weights: BodyWeightEntry[] }> = {
  regular: {
    label: "10 weeks of steady gym training, muscle goal",
    profile: baseProfile({
      trainingStartDate: shiftDate(BENCH_TODAY, -75), heightCm: 176, birthYear: 1993, experience: "intermediate", goal: "muscle", deadliftEnabled: true,
      equipmentAvailability: "verified", availableEquipment: ["dumbbells", "bench", "barbell", "rack", "cable_machine", "gym_machines"],
    }),
    sessions: regularSessions,
    weights: [weight(60, 80), weight(30, 79.2), weight(3, 78.4)],
  },
  newbie: {
    label: "brand-new account, nothing logged",
    profile: baseProfile({ trainingStartDate: BENCH_TODAY, experience: "beginner", goal: "general", heightCm: 168, birthYear: 2000, equipmentAvailability: "unknown", availableEquipment: [] }),
    sessions: () => [],
    weights: [],
  },
  mixed: {
    label: "skipped and partly done workouts, sore legs, today started",
    profile: baseProfile({
      trainingStartDate: shiftDate(BENCH_TODAY, -20), experience: "beginner", goal: "tone", heightCm: 162, birthYear: 1997,
      equipmentAvailability: "verified", availableEquipment: ["dumbbells", "bench", "cable_machine", "gym_machines"],
    }),
    sessions: mixedSessions,
    weights: [weight(18, 64), weight(2, 63.5)],
  },
  restricted: {
    label: "home dumbbells only, deadlifts not approved by the trainer, fat-loss goal",
    profile: baseProfile({
      trainingStartDate: shiftDate(BENCH_TODAY, -40), experience: "beginner", goal: "fatloss", heightCm: 170, birthYear: 1988, deadliftEnabled: false,
      equipmentAvailability: "verified", availableEquipment: ["dumbbells", "bench", "mat"],
    }),
    sessions: () => [
      session(shiftDate(BENCH_TODAY, -5), [["goblet_squat", 3, 12], ["dumbbell_bench", 3, 10]]),
      session(shiftDate(BENCH_TODAY, -2), [["one_arm_db_row", 3, 12]]),
    ],
    weights: [weight(35, 92), weight(4, 89.5)],
  },
};

const contexts = new Map<SampleId, RoziContext>();

/** The tools' context for a sample account (built once). */
export function sampleContext(id: SampleId): RoziContext {
  let ctx = contexts.get(id);
  if (!ctx) {
    const sample = SAMPLES[id];
    ctx = roziContext({ profile: sample.profile, sessions: sample.sessions(), bodyWeightEntries: sample.weights, trainerRuleSettings: undefined, trainerRuleRevision: 1 }, BENCH_TODAY, BENCH_HOUR);
    contexts.set(id, ctx);
  }
  return ctx;
}
