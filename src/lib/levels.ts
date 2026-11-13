import type { ExperienceLevel, Profile, WorkoutSession } from "./types";

/**
 * Fitness level: where a person starts, and how the plan grows with them.
 *
 * - The level picks the starting stage of the 52-week program (an intermediate starts at the
 *   "week 13" stage, not at "learn the movements"), the set count, and whether the gentle
 *   two-set foundation weeks apply.
 * - Levels go up by themselves once enough steady, pain-free training has been done at the current level.
 * - A long break (6 weeks without a workout) moves one level down, so the comeback is not too hard.
 */
export const LEVELS: ExperienceLevel[] = ["beginner", "intermediate", "advanced", "pro"];

export interface LevelOption {
  id: ExperienceLevel;
  title: string;
  note: string;
}

export const LEVEL_OPTIONS: LevelOption[] = [
  { id: "beginner", title: "Beginner", note: "New to workouts, or back after a long break" },
  { id: "intermediate", title: "Intermediate", note: "Training on and off for 6+ months" },
  { id: "advanced", title: "Advanced", note: "Training regularly for 1–2 years" },
  { id: "pro", title: "Pro", note: "Years of steady training, comfortable with heavy lifts" },
];

/** Program week each level starts from (each is the first week of a 4-week block). */
const LEVEL_START_WEEK: Record<ExperienceLevel, number> = { beginner: 1, intermediate: 13, advanced: 25, pro: 37 };

/** What it takes to move up from a level: weeks at the level and workouts finished at the level. */
const LEVEL_UP: Record<Exclude<ExperienceLevel, "pro">, { weeks: number; workouts: number }> = {
  beginner: { weeks: 8, workouts: 20 },
  intermediate: { weeks: 12, workouts: 36 },
  advanced: { weeks: 16, workouts: 56 },
};

/** Share of planned workouts that must be done in the last 4 weeks before moving up. */
const STEADY_SHARE = 0.75;
const PAIN_FREE_DAYS = 14;
const BREAK_DAYS = 42;

export function levelOf(profile: Pick<Profile, "experience">): ExperienceLevel {
  return LEVELS.includes(profile.experience) ? profile.experience : "beginner";
}

export function levelTitle(level: ExperienceLevel): string {
  return LEVEL_OPTIONS.find((option) => option.id === level)?.title ?? "Beginner";
}

/** The day the current level started: when it was reached, or the training start date. */
export function levelStart(profile: Pick<Profile, "levelSince" | "trainingStartDate">): string {
  return profile.levelSince && profile.levelSince > profile.trainingStartDate ? profile.levelSince : profile.trainingStartDate;
}

function daysBetween(later: string, earlier: string): number {
  return Math.floor((Date.parse(`${later}T12:00:00Z`) - Date.parse(`${earlier}T12:00:00Z`)) / 86_400_000);
}

/**
 * Week of the 52-week program, 1–52. It starts at the level's stage on the day the level began
 * and moves on one week every 7 days; after week 52 it starts again at week 1.
 */
export function programWeek(profile: Pick<Profile, "experience" | "levelSince" | "trainingStartDate">, date: string): number {
  const weeks = Math.floor(Math.max(0, daysBetween(date, levelStart(profile))) / 7);
  return ((LEVEL_START_WEEK[levelOf(profile)] - 1 + weeks) % 52) + 1;
}

/** Extra working sets on the first (main) exercises: advanced +1 on two, pro +1 on three. */
export function extraSets(level: ExperienceLevel, exerciseIndex: number): number {
  if (level === "advanced") return exerciseIndex < 2 ? 1 : 0;
  if (level === "pro") return exerciseIndex < 3 ? 1 : 0;
  return 0;
}

/** Extra sets an exercise may have above the goal's usual cap. */
export function levelSetBonus(level: ExperienceLevel): number {
  return level === "advanced" || level === "pro" ? 1 : 0;
}

/** Only beginners get the gentle two-set foundation weeks. */
export function usesFoundationWeeks(level: ExperienceLevel): boolean {
  return level === "beginner";
}

export interface LevelRequirement {
  label: string;
  done: number;
  needed: number;
  met: boolean;
}

export interface LevelProgress {
  level: ExperienceLevel;
  next: ExperienceLevel | null;
  requirements: LevelRequirement[];
  /** 0–1, the average of the requirements (each capped at 1). */
  share: number;
}

function completedSince(sessions: WorkoutSession[], from: string, to: string): WorkoutSession[] {
  return sessions.filter((session) => session.status === "completed" && !session.missedReason && session.date >= from && session.date <= to);
}

/** How close the person is to the next level. */
export function levelProgress(profile: Pick<Profile, "experience" | "levelSince" | "trainingStartDate" | "sessionsPerWeek">, sessions: WorkoutSession[], today: string): LevelProgress {
  const level = levelOf(profile);
  const next = level === "pro" ? null : LEVELS[LEVELS.indexOf(level) + 1];
  if (!next || level === "pro") return { level, next: null, requirements: [], share: 1 };
  const rule = LEVEL_UP[level];
  const since = levelStart(profile);
  const weeksAtLevel = Math.max(0, Math.floor(daysBetween(today, since) / 7));
  const workouts = completedSince(sessions, since, today).length;
  const fourWeeksAgo = new Date(Date.parse(`${today}T12:00:00Z`) - 27 * 86_400_000).toISOString().slice(0, 10);
  const recent = completedSince(sessions, fourWeeksAgo, today).length;
  const steadyNeeded = Math.ceil(profile.sessionsPerWeek * 4 * STEADY_SHARE);
  const painDays = sessions
    .filter((session) => session.date <= today && daysBetween(today, session.date) < PAIN_FREE_DAYS)
    .filter((session) => session.checkIn?.pain || session.review?.discomfort).length;
  const requirements: LevelRequirement[] = [
    { label: `Weeks at ${levelTitle(level)}`, done: Math.min(weeksAtLevel, rule.weeks), needed: rule.weeks, met: weeksAtLevel >= rule.weeks },
    { label: "Workouts finished", done: Math.min(workouts, rule.workouts), needed: rule.workouts, met: workouts >= rule.workouts },
    { label: "Workouts in the last 4 weeks", done: Math.min(recent, steadyNeeded), needed: steadyNeeded, met: recent >= steadyNeeded },
    { label: "Pain-free for 2 weeks", done: painDays ? 0 : 1, needed: 1, met: painDays === 0 },
  ];
  const share = requirements.reduce((sum, item) => sum + Math.min(1, item.done / item.needed), 0) / requirements.length;
  return { level, next, requirements, share };
}

export interface LevelChange {
  from: ExperienceLevel;
  to: ExperienceLevel;
  direction: "up" | "down";
  reason: string;
}

/** Whether the level should change today. Called after workouts load; the result is saved with today's date. */
export function checkLevelChange(profile: Pick<Profile, "experience" | "levelSince" | "trainingStartDate" | "sessionsPerWeek">, sessions: WorkoutSession[], today: string): LevelChange | null {
  const level = levelOf(profile);
  const index = LEVELS.indexOf(level);
  const since = levelStart(profile);

  // A long break steps down one level (once per break: the new level starts today).
  if (index > 0 && daysBetween(today, since) >= BREAK_DAYS) {
    const lastDone = sessions.filter((session) => session.status === "completed" && !session.missedReason && session.date <= today).map((session) => session.date).sort().at(-1);
    if (!lastDone || daysBetween(today, lastDone) >= BREAK_DAYS) {
      const to = LEVELS[index - 1];
      return { from: level, to, direction: "down", reason: `After 6 weeks without a workout, your plan eases back to ${levelTitle(to)} so the comeback feels good.` };
    }
  }

  const progress = levelProgress(profile, sessions, today);
  if (progress.next && progress.requirements.every((item) => item.met)) {
    return { from: level, to: progress.next, direction: "up", reason: `Steady, pain-free training moved you up to ${levelTitle(progress.next)}. Your workouts now have a bit more to them.` };
  }
  return null;
}
