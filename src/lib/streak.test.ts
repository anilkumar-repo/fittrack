import assert from "node:assert/strict";
import test from "node:test";
import { buildStreakTimeline, monthGrid, REPAIRS_PER_STREAK, weekStrip } from "./streak.ts";
import type { MissedReason, WorkoutSession } from "./types";

// Monday, Wednesday, Friday training. 2026-11-02 is a Monday.
const profile = { trainingDays: [1, 3, 5], trainingStartDate: "2026-11-02" };
const plan = { exercises: [] } as unknown as WorkoutSession["plan"];
const done = (date: string): WorkoutSession => ({ id: date, date, status: "completed", plan, exerciseLogs: [] });
const missed = (date: string, reason: MissedReason): WorkoutSession => ({ id: date, date, status: "skipped", plan, exerciseLogs: [], missedReason: { reason, note: "" } });

test("workouts build the streak; rest days are dots and never break it", () => {
  const t = buildStreakTimeline(profile, [done("2026-11-02"), done("2026-11-04"), done("2026-11-06")], "2026-11-08");
  assert.equal(t.current, 3);
  assert.equal(t.days["2026-11-03"], "rest");
  assert.equal(t.days["2026-11-06"], "done");
  assert.equal(t.repair, null);
  assert.equal(t.repairsLeft, REPAIRS_PER_STREAK);
});

test("a missed day breaks the streak but a workout within 7 days repairs it and uses one repair", () => {
  const before = [done("2026-11-02"), done("2026-11-04")];
  const broken = buildStreakTimeline(profile, before, "2026-11-07");
  assert.equal(broken.current, 0);
  assert.equal(broken.broken, true);
  assert.deepEqual(broken.repair, { lostStreak: 2, deadline: "2026-11-13" });
  const fixed = buildStreakTimeline(profile, [...before, done("2026-11-09")], "2026-11-09");
  assert.equal(fixed.current, 3);
  assert.equal(fixed.days["2026-11-06"], "repaired");
  assert.equal(fixed.repairsLeft, REPAIRS_PER_STREAK - 1);
  assert.deepEqual(fixed.repairedOn, ["2026-11-09"]);
});

test("the deadline day itself still repairs, and today never closes the window", () => {
  const before = [done("2026-11-02"), done("2026-11-04")];
  assert.equal(buildStreakTimeline(profile, before, "2026-11-13").repair?.lostStreak, 2);
  assert.equal(buildStreakTimeline(profile, [...before, done("2026-11-13")], "2026-11-13").current, 3);
});

test("after the 7-day window the streak restarts from one with fresh repairs", () => {
  const t = buildStreakTimeline(profile, [done("2026-11-02"), done("2026-11-04"), done("2026-11-16")], "2026-11-16");
  assert.equal(t.current, 1);
  assert.equal(t.best, 2);
  assert.equal(t.days["2026-11-06"], "missed");
  assert.equal(t.repairsLeft, REPAIRS_PER_STREAK);
});

test("after five repairs the next break restarts the streak at day one", () => {
  // Each week: train Monday, miss Wednesday, train Friday (a repair). Five repairs, then one more miss.
  const sessions: WorkoutSession[] = [];
  const weeks = ["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30", "2026-12-07"];
  for (const monday of weeks) {
    const friday = new Date(`${monday}T12:00:00Z`); friday.setUTCDate(friday.getUTCDate() + 4);
    sessions.push(done(monday), done(friday.toISOString().slice(0, 10)));
  }
  const t = buildStreakTimeline(profile, sessions, "2026-12-11");
  assert.equal(t.repairedOn.length, 5);
  assert.equal(t.current, 1); // the sixth break could not be repaired
  assert.equal(t.repairsLeft, REPAIRS_PER_STREAK); // the new streak starts with fresh repairs
});

test("missing for illness, soreness or travel pauses the streak instead of breaking it", () => {
  const t = buildStreakTimeline(profile, [done("2026-11-02"), missed("2026-11-04", "unwell"), done("2026-11-06")], "2026-11-06");
  assert.equal(t.days["2026-11-04"], "paused");
  assert.equal(t.current, 2);
  assert.equal(t.repairsLeft, REPAIRS_PER_STREAK);
  const busy = buildStreakTimeline(profile, [done("2026-11-02"), missed("2026-11-04", "busy")], "2026-11-05");
  assert.equal(busy.days["2026-11-04"], "missed");
});

test("calendar grid starts on Monday and the week strip covers Monday to Sunday", () => {
  const grid = monthGrid(2026, 11);
  assert.equal(grid[0][6], "2026-11-01"); // 1 November 2026 is a Sunday
  assert.equal(grid.flat().filter(Boolean).length, 30);
  const strip = weekStrip(buildStreakTimeline(profile, [done("2026-11-02")], "2026-11-04"), "2026-11-04");
  assert.deepEqual(strip.map((day) => day.status), ["done", "rest", "today", "upcoming", "upcoming", "upcoming", "upcoming"]);
});
