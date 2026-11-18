import assert from "node:assert/strict";
import test from "node:test";
import { buddyStreak, buddyToday, carryableDay, missedRecently, quickVersion, type BuddyDay } from "./buddies.ts";
import { inLightWeek } from "./program.ts";
import { calendarSessionIndex, generateWorkout } from "./planner.ts";
import { createDemoState } from "./demo-data.ts";
import type { Profile, WorkoutPlan, WorkoutSession } from "./types";

// 2026-11-17 is a Tuesday. The group trains Mon / Wed / Fri and started on Mon 2 Nov.
const group = { trainingDays: [1, 3, 5], since: "2026-11-02", members: ["a", "b"] };
const done = (userId: string, date: string): BuddyDay => ({ userId, date, status: "completed" });

test("calendar rotation: counts the group's training days since the start date", () => {
  assert.equal(calendarSessionIndex("2026-11-02", "2026-11-02", [1, 3, 5]), 0);
  assert.equal(calendarSessionIndex("2026-11-02", "2026-11-04", [1, 3, 5]), 1); // Mon counted
  assert.equal(calendarSessionIndex("2026-11-02", "2026-11-16", [1, 3, 5]), 6); // two full weeks
  assert.equal(calendarSessionIndex("2026-11-02", "2026-11-18", [1, 3, 5]), 7);
});

test("buddies get the same session on the same day, even when one of them skipped", () => {
  const base: Profile = { ...createDemoState().profile, goal: "muscle", trainingDays: [1, 3, 5], sessionsPerWeek: 3, trainingStartDate: "2026-10-01", buddyAnchor: "2026-11-02" };
  const session = (date: string, focus: string, status: WorkoutSession["status"] = "completed"): WorkoutSession =>
    ({ id: date, date, status, plan: { focus } as unknown as WorkoutPlan, exerciseLogs: [] });
  // Anil trained every day; Ravi skipped Wednesday 11 Nov.
  const anil = [session("2026-11-09", "Push A"), session("2026-11-11", "Pull A"), session("2026-11-13", "Legs A")];
  const ravi = [session("2026-11-09", "Push A"), session("2026-11-13", "Legs A")];
  const a = generateWorkout({ date: "2026-11-16", profile: base, sessions: anil });
  const b = generateWorkout({ date: "2026-11-16", profile: base, sessions: ravi });
  assert.ok(a && b);
  assert.equal(a.focus, b.focus);
  // Without the group, Ravi's rotation (by completed workouts) would differ from Anil's.
  const soloAnil = generateWorkout({ date: "2026-11-16", profile: { ...base, buddyAnchor: undefined }, sessions: anil });
  const soloRavi = generateWorkout({ date: "2026-11-16", profile: { ...base, buddyAnchor: undefined }, sessions: ravi });
  assert.notEqual(soloAnil?.focus, soloRavi?.focus);
});

test("buddy today: done, training, skipped, to do, or a rest day", () => {
  const days: BuddyDay[] = [done("a", "2026-11-16"), { userId: "b", date: "2026-11-16", status: "in_progress" }, { userId: "a", date: "2026-11-18", status: "skipped" }];
  assert.equal(buddyToday(days, "a", "2026-11-16", [1, 3, 5]), "done");
  assert.equal(buddyToday(days, "b", "2026-11-16", [1, 3, 5]), "training");
  assert.equal(buddyToday(days, "a", "2026-11-18", [1, 3, 5]), "skipped");
  assert.equal(buddyToday(days, "b", "2026-11-18", [1, 3, 5]), "to-do");
  assert.equal(buddyToday(days, "b", "2026-11-17", [1, 3, 5]), "rest");
});

test("buddy streak: days everyone trained, carried days count, an unfinished today doesn't break it", () => {
  const days = [done("a", "2026-11-09"), done("b", "2026-11-09"), done("a", "2026-11-11"), done("a", "2026-11-13"), done("b", "2026-11-13"), done("a", "2026-11-16"), done("b", "2026-11-16")];
  // Wed 11: only a trained → the streak stops there (Fri 13 + Mon 16 = 2).
  assert.equal(buddyStreak({ ...group, days, carried: [], today: "2026-11-17" }), 2);
  // Carry Wed 11 → 9, 11, 13, 16 = 4 (and Fri 6 wasn't done, so it stops).
  assert.equal(buddyStreak({ ...group, days, carried: ["2026-11-11"], today: "2026-11-17" }), 4);
  assert.equal(carryableDay({ ...group, days, carried: [], today: "2026-11-17" }), "2026-11-11");
  assert.equal(carryableDay({ ...group, days, carried: ["2026-11-11"], today: "2026-11-17" }), null);
  // Alone, there's no buddy streak.
  assert.equal(buddyStreak({ ...group, members: ["a"], days, carried: [], today: "2026-11-17" }), 0);
});

test("quick version: three main exercises, at most 2 sets, 20 minutes", () => {
  const plan = generateWorkout({ date: "2026-11-16", profile: { ...createDemoState().profile, goal: "muscle", trainingDays: [1, 3, 5], sessionsPerWeek: 3, trainingStartDate: "2026-10-01" }, sessions: [] });
  assert.ok(plan);
  const quick = quickVersion(plan);
  assert.equal(quick.exercises.length, 3);
  assert.ok(quick.exercises.every((exercise) => exercise.sets <= 2 && exercise.category === "strength"));
  assert.equal(quick.durationMinutes, 20);
  assert.equal(quick.quick, true);
  assert.equal(quick.focus, plan.focus);
  assert.match(quick.title, /^Quick · /);
});

test("lighter week: the 7 days from the Monday the trainer picked", () => {
  assert.equal(inLightWeek("2026-11-16", "2026-11-16"), true);
  assert.equal(inLightWeek("2026-11-16", "2026-11-22"), true);
  assert.equal(inLightWeek("2026-11-16", "2026-11-23"), false);
  assert.equal(inLightWeek("2026-11-16", "2026-11-15"), false);
  assert.equal(inLightWeek(undefined, "2026-11-16"), false);
});

test("lighter week: the same session as the group, with fewer sets and no extra focus set", () => {
  const base: Profile = { ...createDemoState().profile, goal: "tone", trainingDays: [1, 3, 5], sessionsPerWeek: 3, trainingStartDate: "2026-09-08", buddyAnchor: "2026-11-02", focusArea: "glutes" };
  const normal = generateWorkout({ date: "2026-11-18", profile: base, sessions: [] });
  const light = generateWorkout({ date: "2026-11-18", profile: { ...base, lightWeekStart: "2026-11-16" }, sessions: [] });
  const nextWeek = generateWorkout({ date: "2026-11-23", profile: { ...base, lightWeekStart: "2026-11-16" }, sessions: [] });
  assert.ok(normal && light && nextWeek);
  assert.equal(normal.recoveryWeek, false); // a normal week, so the difference is the trainer's lighter week
  const sets = (plan: WorkoutPlan) => plan.exercises.reduce((sum, exercise) => sum + exercise.sets, 0);
  assert.equal(light.focus, normal.focus);
  assert.ok(sets(light) < sets(normal), `${sets(light)} < ${sets(normal)}`);
  assert.equal(light.lightWeek, true);
  assert.match(light.description, /^Lighter week from your trainer/);
  assert.ok(light.generationReasons.some((reason) => reason.startsWith("Your trainer made this week lighter")));
  assert.equal(nextWeek.lightWeek, undefined);
});

test("missed recently: the group's training days in the last week someone didn't finish", () => {
  // Today Tue 17 Nov; the last 7 days hold Wed 11, Fri 13, Mon 16.
  const days: BuddyDay[] = [done("a", "2026-11-11"), done("a", "2026-11-13"), done("a", "2026-11-16"), done("b", "2026-11-13"), { userId: "b", date: "2026-11-16", status: "skipped" }];
  assert.equal(missedRecently(days, "a", "2026-11-17", [1, 3, 5], "2026-11-02"), 0);
  assert.equal(missedRecently(days, "b", "2026-11-17", [1, 3, 5], "2026-11-02"), 2);
  // Days before the group started don't count.
  assert.equal(missedRecently(days, "b", "2026-11-17", [1, 3, 5], "2026-11-13"), 1);
});
