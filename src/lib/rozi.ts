import { calculateAchievements, type AchievementId } from "./achievements.ts";
import { shiftDate, weekdayOf } from "./dates.ts";
import { calculatePersonalRecords } from "./progress.ts";
import type { Profile, WorkoutSession } from "./types";

/** Every picture of Rozi, the RozFit mascot. Each is a file in public/rozi. */
export const ROZI_MOODS = [
  "base", "morning", "afternoon", "evening", "night", "cheer", "streak-risk", "grumpy", "comeback", "milestone",
  "trophy", "personal-record", "rest", "care", "workout", "energy-1", "energy-2", "energy-3", "energy-4", "energy-5",
  "hello", "signin", "full-body", "upper-body", "lower-body", "stretch", "water",
] as const;
export type RoziMood = (typeof ROZI_MOODS)[number];

export interface Streak {
  /** Planned training days completed in a row, up to today. Rest days never break it. */
  current: number;
  best: number;
  /** True once at least one workout has been completed. */
  started: boolean;
  /** A planned training day before today was missed and nothing has been completed since. */
  broken: boolean;
  /** Days since the last completed workout, or null if there has never been one. */
  daysSinceLastWorkout: number | null;
  todayPlanned: boolean;
  todayDone: boolean;
  /** Today's workout is the first one after a missed day. */
  comebackToday: boolean;
}

const LONG_BREAK_DAYS = 14;

function isPlanned(profile: Pick<Profile, "trainingDays" | "trainingStartDate">, date: string): boolean {
  return date >= profile.trainingStartDate && profile.trainingDays.includes(weekdayOf(date));
}

/**
 * A streak counts planned training days completed in a row. Rest days are skipped, a workout on a rest day
 * adds to it, and today's planned workout does not break it until the day is over.
 */
export function calculateStreak(profile: Pick<Profile, "trainingDays" | "trainingStartDate">, sessions: WorkoutSession[], today: string): Streak {
  const done = new Set(sessions.filter((session) => !session.sampleData && session.status === "completed" && session.date <= today).map((session) => session.date));
  const todayPlanned = isPlanned(profile, today);
  const todayDone = done.has(today);
  const lastDone = [...done].sort().at(-1) ?? null;
  const daysSinceLastWorkout = lastDone === null ? null : Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${lastDone}T12:00:00Z`)) / 86_400_000);

  // Walk forward from the start so the best streak and the current one use the same rules.
  let current = 0;
  let best = 0;
  let missedBeforeCurrent = false;
  const start = [...done].sort()[0] && [...done].sort()[0] < profile.trainingStartDate ? [...done].sort()[0] : profile.trainingStartDate;
  for (let date = start, guard = 0; date <= today && guard < 2000; date = shiftDate(date, 1), guard += 1) {
    if (done.has(date)) {
      if (current === 0) missedBeforeCurrent = false;
      current += 1;
      best = Math.max(best, current);
    } else if (isPlanned(profile, date) && date < today) {
      if (current > 0 || done.size > 0) missedBeforeCurrent = true;
      current = 0;
    }
  }

  const started = done.size > 0;
  const broken = started && current === 0 && missedBeforeCurrent;
  // The run that ends today started right after a missed day.
  let comebackToday = false;
  if (todayDone && current === 1) {
    const before = [...done].filter((date) => date < today);
    comebackToday = before.length > 0;
  }
  return { current, best, started, broken, daysSinceLastWorkout, todayPlanned, todayDone, comebackToday };
}

export interface WorkoutWins {
  newRecord: boolean;
  /** A big achievement (10 or 25 workouts, 4 weeks in a row) was earned with this workout. */
  bigMilestone: boolean;
  milestone: boolean;
  earned: AchievementId[];
}

const BIG_MILESTONES = new Set<AchievementId>(["ten-workouts", "twenty-five-workouts", "four-weeks"]);

/** What a workout saved on `date` achieved: new load records and newly earned badges. */
export function winsForWorkout(sessions: WorkoutSession[], date: string, sessionsPerWeek: number): WorkoutWins {
  const without = sessions.filter((session) => session.date !== date);
  const before = calculatePersonalRecords(without);
  const after = calculatePersonalRecords(sessions);
  const newRecord = after.some((record) => record.date === date && before.some((old) => old.exerciseId === record.exerciseId && record.loadKg > old.loadKg));
  const earnedBefore = new Set(calculateAchievements(without, sessionsPerWeek, before.length).filter((item) => item.earned).map((item) => item.id));
  const earned = calculateAchievements(sessions, sessionsPerWeek, after.length).filter((item) => item.earned && !earnedBefore.has(item.id)).map((item) => item.id);
  return { newRecord, bigMilestone: earned.some((id) => BIG_MILESTONES.has(id)), milestone: earned.length > 0, earned };
}

export interface RoziMoment {
  mood: RoziMood;
  title: string;
  message: string;
}

interface MomentInput {
  streak: Streak;
  todaySession?: WorkoutSession;
  hour: number;
  name: string;
  wins?: WorkoutWins;
}

function timeOfDay(hour: number): "morning" | "afternoon" | "evening" | "night" {
  return hour < 12 ? "morning" : hour < 17 ? "afternoon" : hour < 21 ? "evening" : "night";
}

/** Which Rozi to show on Home, and what Rozi says. Kind words always; grumpy only for a missed day. */
export function roziMoment({ streak, todaySession, hour, name, wins }: MomentInput): RoziMoment {
  const run = streak.current;
  const inARow = `${run} ${run === 1 ? "session" : "sessions"} in a row`;
  if (todaySession?.status === "completed") {
    if (wins?.newRecord) return { mood: "personal-record", title: "New personal record!", message: `You lifted more than ever before. ${inARow}.` };
    if (wins?.bigMilestone) return { mood: "trophy", title: "Big milestone!", message: "You earned a new achievement. Look how far you’ve come." };
    if (wins?.milestone) return { mood: "milestone", title: "Achievement unlocked!", message: "A new badge is waiting on your Progress page." };
    if (streak.comebackToday) return { mood: "comeback", title: "Welcome back!", message: "You came back, and that’s what counts. New streak started." };
    return { mood: "cheer", title: "Workout done!", message: run > 1 ? `That’s ${inARow}. Keep it going!` : "Great job showing up today." };
  }
  if (todaySession?.status === "in_progress") return { mood: "workout", title: "You’ve got this", message: "Workout in progress. Take your time between sets." };
  if (todaySession?.checkIn?.pain || todaySession?.plan.sessionType === "recovery") {
    return { mood: "care", title: "Take it gently today", message: "Recovery counts too. Stop anything that hurts." };
  }
  if (streak.broken) {
    if ((streak.daysSinceLastWorkout ?? 0) >= LONG_BREAK_DAYS) return { mood: "comeback", title: `I missed you, ${name}!`, message: "No pressure. Your next session is a gentle restart." };
    return { mood: "grumpy", title: "Hmph. We missed one.", message: "It happens. Tomorrow’s a fresh start, and I’ll be here." };
  }
  if (streak.todayPlanned && !streak.todayDone && hour >= 17) {
    return { mood: "streak-risk", title: "Still time today!", message: run > 0 ? `Keep your ${inARow} going. Even a short session counts.` : "A short session tonight still counts." };
  }
  const period = timeOfDay(hour);
  if (!streak.todayPlanned) {
    if (period === "night") return { mood: "night", title: `Good night, ${name}`, message: "Rest day done. Sleep well." };
    return { mood: "rest", title: "Rest day", message: run > 0 ? `Recharge today. Your streak is safe: ${inARow}.` : "Recharge today. Your muscles grow while you rest." };
  }
  const greeting = { morning: "Good morning", afternoon: "Good afternoon", evening: "Good evening", night: "Good evening" }[period];
  const mood: RoziMood = period;
  return { mood, title: `${greeting}, ${name}`, message: run > 0 ? `${inARow}. Today’s workout is ready when you are.` : "Today’s workout is ready when you are." };
}

export const ENERGY_LABELS = ["Drained", "Low", "Okay", "Good", "Great"] as const;

export function energyMood(level: number): RoziMood {
  const clamped = Math.min(5, Math.max(1, Math.round(level)));
  return `energy-${clamped}` as RoziMood;
}
