import assert from "node:assert/strict";
import test from "node:test";
import { calculateAchievements } from "./achievements.ts";
import { createDemoState } from "./demo-data.ts";
import { generateWorkout } from "./planner.ts";
import type { WorkoutSession } from "./types";

const profile = { ...createDemoState().profile, trainingDays: [1, 2, 3, 4, 5, 6, 0] };
function session(date: string, status: WorkoutSession["status"] = "completed", sampleData = false): WorkoutSession {
  const plan = generateWorkout({ date, profile, sessions: [] });
  assert.ok(plan);
  return { id: date, date, status, plan, exerciseLogs: [], ...(sampleData ? { sampleData } : {}) };
}
const earned = (list: ReturnType<typeof calculateAchievements>) => list.filter((item) => item.earned).map((item) => item.id);

test("no badges are earned without completed workouts, and unfinished or sample sessions do not count", () => {
  const list = calculateAchievements([session("2026-11-10", "in_progress"), session("2026-11-11", "planned"), session("2026-11-12", "completed", true)], 3, 0);
  assert.deepEqual(earned(list), []);
  assert.equal(list.find((item) => item.id === "first-workout")?.current, 0);
});

test("counts workouts, a full week, and progress toward the next badge", () => {
  const list = calculateAchievements([session("2026-11-09"), session("2026-11-11"), session("2026-11-13"), session("2026-11-17")], 3, 1);
  assert.deepEqual(earned(list), ["first-workout", "full-week", "first-load"]);
  const five = list.find((item) => item.id === "five-workouts");
  assert.equal(five?.current, 4);
  assert.equal(five?.target, 5);
  assert.equal(list.find((item) => item.id === "two-weeks")?.current, 1);
});

test("weeks in a row must be consecutive calendar weeks that each meet the weekly goal", () => {
  const twoRunning = [session("2026-11-02"), session("2026-11-04"), session("2026-11-09"), session("2026-11-11")];
  assert.ok(earned(calculateAchievements(twoRunning, 2, 0)).includes("two-weeks"));
  const withGap = [session("2026-10-26"), session("2026-10-28"), session("2026-11-09"), session("2026-11-11")];
  assert.ok(!earned(calculateAchievements(withGap, 2, 0)).includes("two-weeks"));
  const shortWeek = [session("2026-11-02"), session("2026-11-04"), session("2026-11-09")];
  assert.ok(!earned(calculateAchievements(shortWeek, 2, 0)).includes("two-weeks"));
});
