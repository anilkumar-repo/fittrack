import type { Profile, TrainingGoal } from "./types";

export interface GoalOption {
  id: TrainingGoal;
  title: string;
  note: string;
  /** Suggested training days (0 = Sunday) when the goal is picked. */
  days: number[];
}

export const GOAL_OPTIONS: GoalOption[] = [
  { id: "general", title: "Stay active", note: "3 full-body days · gentle and simple", days: [2, 4, 6] },
  { id: "tone", title: "Get fit & toned", note: "4 days · upper / lower · strength, tone and cardio", days: [1, 2, 4, 5] },
  { id: "fatloss", title: "Lose weight", note: "4 days · strength + cardio · burn fat, keep muscle", days: [1, 2, 4, 5] },
  { id: "muscle", title: "Build muscle", note: "6 days · push / pull / legs · lean muscle and definition", days: [1, 2, 3, 4, 5, 6] },
];

export function goalOf(profile: Pick<Profile, "goal">): TrainingGoal {
  return profile.goal === "muscle" || profile.goal === "tone" || profile.goal === "fatloss" ? profile.goal : "general";
}

export function goalTitle(goal: TrainingGoal): string {
  return GOAL_OPTIONS.find((option) => option.id === goal)?.title ?? "Stay active";
}

/** Week of the training year, 1–52, counted from the training start date. Day 365 starts the next year at week 1. */
export function trainingWeek(trainingStartDate: string, date: string): number {
  const days = Math.max(0, Math.floor((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${trainingStartDate}T12:00:00Z`)) / 86_400_000));
  return (Math.floor(days / 7) % 52) + 1;
}

/** Every fourth week is lighter. Build muscle swaps it for a conditioning week; Get fit & toned cuts the sets. */
export function isRecoveryWeek(goal: TrainingGoal, week: number): boolean {
  return goal !== "general" && week % 4 === 0;
}

const MUSCLE_STAGES: Array<[fromWeek: number, label: string]> = [
  [1, "Foundation: set your working weights"], [5, "Build: add reps before weight"], [9, "Build: add weight once reps are met"],
  [13, "Strength and size"], [17, "Hypertrophy: quality sets"], [21, "Strength: small load steps"], [25, "Hypertrophy: balanced volume"],
  [29, "Strength and weak points"], [33, "Hypertrophy and overload"], [37, "Strength with clean technique"], [41, "Lagging muscle groups"],
  [45, "Consolidate strength and muscle"], [49, "Final progressive block"],
];

const TONE_STAGES: Array<[fromWeek: number, label: string]> = [
  [1, "Learn the movements"], [5, "Foundation: consistency"], [9, "Foundation: confidence"], [13, "Beginner to intermediate"],
  [25, "Intermediate strength"], [37, "Advanced transition"], [49, "Consolidate your progress"],
];

const FATLOSS_STAGES: Array<[fromWeek: number, label: string]> = [
  [1, "Build the habit"], [5, "Burn: add reps and minutes"], [13, "Strength + conditioning"], [25, "Push the pace"],
  [37, "Keep it off: steady routine"], [49, "Consolidate your progress"],
];

/** The stage name shown with a plan, for example "Week 6 · Build: add reps before weight". */
export function stageLabel(goal: TrainingGoal, week: number): string | undefined {
  if (goal === "general") return undefined;
  if (week === 52) return "Recovery and yearly review";
  if (isRecoveryWeek(goal, week)) return goal === "muscle" ? "Conditioning week" : "Recovery week: lighter sets";
  const stages = goal === "muscle" ? MUSCLE_STAGES : goal === "fatloss" ? FATLOSS_STAGES : TONE_STAGES;
  return [...stages].reverse().find(([from]) => week >= from)?.[1];
}

/** Most working sets allowed per exercise for this goal and week. */
export function setCap(goal: TrainingGoal, week: number, earlyFoundation: boolean, returning: boolean): number {
  if (returning) return 2;
  if (goal === "muscle") return 3;
  if (goal === "tone" || goal === "fatloss") return week <= 4 ? 2 : 3;
  return earlyFoundation ? 2 : 3;
}

/** Recovery weeks keep about two thirds of the usual sets (a 30–40% cut). */
export function recoveryWeekSets(sets: number): number {
  return Math.max(1, Math.round(sets * 0.65));
}
