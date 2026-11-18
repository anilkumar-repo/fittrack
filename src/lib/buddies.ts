import { shiftDate, weekdayOf } from "./dates.ts";
import type { WorkoutPlan } from "./types";

// ---------- Train together ----------

/** At most 4 people train together: you and 3 buddies. */
export const MAX_GROUP = 4;

/** One person's day as buddies see it (the reason only when that person shares reasons). */
export interface BuddyDay { userId: string; date: string; status: string; reason?: string | null }

export type BuddyToday = "done" | "training" | "skipped" | "to-do" | "rest";

/** What a buddy is up to today: done, training now, skipped, still to do, or a rest day for the group. */
export function buddyToday(days: BuddyDay[], userId: string, today: string, trainingDays: number[]): BuddyToday {
  const day = days.find((item) => item.userId === userId && item.date === today);
  if (day?.status === "completed") return "done";
  if (day?.status === "in_progress") return "training";
  if (day?.status === "skipped") return "skipped";
  return trainingDays.includes(weekdayOf(today)) ? "to-do" : "rest";
}

/**
 * The buddy streak: the group's planned training days in a row where everyone trained (or the day was carried).
 * Today only counts once everyone is done, and an unfinished today never breaks it. Starts at the group's start date.
 */
export function buddyStreak(input: { trainingDays: number[]; since: string; members: string[]; days: BuddyDay[]; carried: string[]; today: string }): number {
  const { trainingDays, since, members, days, carried, today } = input;
  if (members.length < 2) return 0;
  const done = new Set(days.filter((day) => day.status === "completed").map((day) => `${day.userId}:${day.date}`));
  const carriedDays = new Set(carried);
  let streak = 0;
  for (let date = today, steps = 0; date >= since && steps < 400; date = shiftDate(date, -1), steps++) {
    if (!trainingDays.includes(weekdayOf(date))) continue;
    const everyone = members.every((id) => done.has(`${id}:${date}`));
    if (everyone || carriedDays.has(date)) streak++;
    else if (date !== today) break;
  }
  return streak;
}

/** The most recent missed group day in the last week that a carry could save (null if none or already carried). */
export function carryableDay(input: { trainingDays: number[]; since: string; members: string[]; days: BuddyDay[]; carried: string[]; today: string }): string | null {
  const done = new Set(input.days.filter((day) => day.status === "completed").map((day) => `${day.userId}:${day.date}`));
  for (let i = 1; i <= 7; i++) {
    const date = shiftDate(input.today, -i);
    if (date < input.since) return null;
    if (!input.trainingDays.includes(weekdayOf(date))) continue;
    if (input.carried.includes(date)) return null;
    // The day was missed by someone, but at least one buddy trained: that's the day worth carrying.
    const trained = input.members.filter((id) => done.has(`${id}:${date}`)).length;
    if (trained === input.members.length) continue;
    return trained > 0 ? date : null;
  }
  return null;
}

/**
 * How many of the group's training days in the last 7 (before today, since the group started) this person didn't
 * finish. Two or more is when the group's coach is asked whether to make the week lighter.
 */
export function missedRecently(days: BuddyDay[], userId: string, today: string, trainingDays: number[], since: string): number {
  const finished = new Set(days.filter((day) => day.userId === userId && day.status === "completed").map((day) => day.date));
  let missed = 0;
  for (let i = 1; i <= 7; i++) {
    const date = shiftDate(today, -i);
    if (date < since) break;
    if (trainingDays.includes(weekdayOf(date)) && !finished.has(date)) missed++;
  }
  return missed;
}

/**
 * "Quick 20-min version" for a day you're short on time: the first three main exercises (core and cardio finishers
 * left out), at most 2 sets each. The session is the same one your buddies do, just shorter.
 */
export function quickVersion(plan: WorkoutPlan): WorkoutPlan {
  const main = plan.exercises.filter((exercise) => exercise.category === "strength");
  const picked = (main.length >= 3 ? main : plan.exercises).slice(0, 3).map((exercise) => ({ ...exercise, sets: Math.min(exercise.sets, 2) }));
  return { ...plan, exercises: picked, durationMinutes: Math.min(plan.durationMinutes, 20), title: plan.title.startsWith("Quick · ") ? plan.title : `Quick · ${plan.title}`, quick: true };
}
