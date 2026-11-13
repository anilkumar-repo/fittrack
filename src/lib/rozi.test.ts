import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { createDemoState } from "./demo-data.ts";
import { generateWorkout } from "./planner.ts";
import { calculateStreak, energyMood, ROZI_MOODS, roziMoment, winsForWorkout } from "./rozi.ts";
import type { WorkoutSession } from "./types";

// Training on Monday, Wednesday and Friday. 2026-11-02 is a Monday.
const profile = { ...createDemoState().profile, trainingDays: [1, 3, 5], trainingStartDate: "2026-11-02", sessionsPerWeek: 3 };
function done(date: string, extra: Partial<WorkoutSession> = {}): WorkoutSession {
  const plan = generateWorkout({ date, profile: { ...profile, trainingDays: [0, 1, 2, 3, 4, 5, 6] }, sessions: [] });
  assert.ok(plan);
  return { id: date, date, status: "completed", plan, exerciseLogs: [], ...extra };
}

test("every Rozi picture exists", () => {
  for (const mood of ROZI_MOODS) assert.ok(existsSync(new URL(`../../public/rozi/${mood}.webp`, import.meta.url)), `missing ${mood}`);
});

test("rest days never break a streak and today's workout is not missed until the day is over", () => {
  const sessions = [done("2026-11-02"), done("2026-11-04"), done("2026-11-06")];
  const sunday = calculateStreak(profile, sessions, "2026-11-08");
  assert.equal(sunday.current, 3);
  assert.equal(sunday.broken, false);
  const mondayMorning = calculateStreak(profile, sessions, "2026-11-09");
  assert.equal(mondayMorning.current, 3);
  assert.equal(mondayMorning.todayPlanned, true);
  assert.equal(mondayMorning.todayDone, false);
});

test("a missed training day breaks the streak, and a workout within 7 days repairs it", () => {
  const sessions = [done("2026-11-02"), done("2026-11-04")];
  const after = calculateStreak(profile, sessions, "2026-11-07");
  assert.equal(after.current, 0);
  assert.equal(after.broken, true);
  assert.equal(after.best, 2);
  assert.deepEqual(after.repair, { lostStreak: 2, deadline: "2026-11-13" });
  assert.match(roziMoment({ streak: after, hour: 10, name: "P" }).message, /win back your 2-workout streak/);
  const repaired = calculateStreak(profile, [...sessions, done("2026-11-09")], "2026-11-09");
  assert.equal(repaired.current, 3);
  assert.equal(repaired.broken, false);
  assert.equal(repaired.repairedToday, true);
  assert.equal(roziMoment({ streak: repaired, todaySession: done("2026-11-09"), hour: 10, name: "P" }).title, "Streak repaired!");
  // Too late to repair: the next workout starts a new streak (a comeback).
  const fresh = calculateStreak(profile, [...sessions, done("2026-11-20")], "2026-11-20");
  assert.equal(fresh.current, 1);
  assert.equal(fresh.comebackToday, true);
});

test("a brand-new person who has not trained yet is never shown as grumpy", () => {
  const streak = calculateStreak(profile, [], "2026-11-07");
  assert.equal(streak.broken, false);
  assert.notEqual(roziMoment({ streak, hour: 10, name: "Priya" }).mood, "grumpy");
});

test("Rozi's mood follows the day: done, at risk, broken, care, rest, and time of day", () => {
  const base = calculateStreak(profile, [done("2026-11-02")], "2026-11-04");
  assert.equal(roziMoment({ streak: base, hour: 8, name: "P" }).mood, "morning");
  assert.equal(roziMoment({ streak: base, hour: 14, name: "P" }).mood, "afternoon");
  assert.equal(roziMoment({ streak: base, hour: 18, name: "P" }).mood, "streak-risk");
  const restDay = calculateStreak(profile, [done("2026-11-02")], "2026-11-03");
  assert.equal(roziMoment({ streak: restDay, hour: 10, name: "P" }).mood, "rest");
  assert.equal(roziMoment({ streak: restDay, hour: 22, name: "P" }).mood, "night");
  const broken = calculateStreak(profile, [done("2026-11-02")], "2026-11-05");
  assert.equal(roziMoment({ streak: broken, hour: 10, name: "P" }).mood, "grumpy");
  const longBreak = calculateStreak(profile, [done("2026-11-02")], "2026-11-27");
  assert.equal(roziMoment({ streak: longBreak, hour: 10, name: "P" }).mood, "comeback");
  const pain = done("2026-11-04", { status: "planned", checkIn: { energy: 3, soreness: 1, pain: true, recovery: 3, discomfort: "", note: "" } });
  assert.equal(roziMoment({ streak: base, todaySession: pain, hour: 10, name: "P" }).mood, "care");
  const finished = calculateStreak(profile, [done("2026-11-02"), done("2026-11-04")], "2026-11-04");
  assert.equal(roziMoment({ streak: finished, todaySession: done("2026-11-04"), hour: 10, name: "P" }).mood, "cheer");
  assert.equal(roziMoment({ streak: finished, todaySession: done("2026-11-04"), hour: 10, name: "P", wins: { newRecord: true, bigMilestone: false, milestone: false, earned: [] } }).mood, "personal-record");
});

test("finds badges first earned by a workout", () => {
  const first = winsForWorkout([done("2026-11-02")], "2026-11-02", 3);
  assert.deepEqual(first.earned, ["first-workout"]);
  assert.equal(first.milestone, true);
  assert.equal(first.bigMilestone, false);
  const second = winsForWorkout([done("2026-11-02"), done("2026-11-04")], "2026-11-04", 3);
  assert.equal(second.milestone, false);
});

test("the energy slider maps 1–5 to Rozi's energy pictures", () => {
  assert.equal(energyMood(1), "energy-1");
  assert.equal(energyMood(5), "energy-5");
  assert.equal(energyMood(9), "energy-5");
});
