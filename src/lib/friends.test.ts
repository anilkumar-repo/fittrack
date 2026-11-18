import assert from "node:assert/strict";
import test from "node:test";
import { challengeLeaderboard, challengeProgress, challengeWindow, computeFriendStats, daysLeft, generateInviteCode, isInviteCode, lastWorkoutLabel, weekStart, type Challenge, type FriendStats } from "./friends.ts";
import { generateWorkout } from "./planner.ts";
import type { Profile, WorkoutPlan, WorkoutSession } from "./types";

const profile: Profile = {
  id: "me", displayName: "Priya", experience: "beginner", sessionsPerWeek: 3, trainingDays: [2, 4, 6], trainingStartDate: "2026-10-01",
  timeZone: "Asia/Kolkata", deadliftEnabled: false, trainerRole: false, preferredSessionMinutes: 40, equipmentAvailability: "unknown", availableEquipment: [], goal: "tone",
};
const done = (date: string): WorkoutSession => ({ id: date, date, status: "completed", plan: generateWorkout({ date, profile, sessions: [] }) as WorkoutPlan, exerciseLogs: [] });

test("weeks start on Monday and months cover the whole month", () => {
  assert.equal(weekStart("2026-11-13"), "2026-11-09");
  assert.equal(weekStart("2026-11-09"), "2026-11-09");
  assert.equal(weekStart("2026-11-15"), "2026-11-09");
  assert.deepEqual(challengeWindow("week", "2026-11-13"), { startsOn: "2026-11-09", endsOn: "2026-11-15" });
  assert.deepEqual(challengeWindow("month", "2026-02-10"), { startsOn: "2026-02-01", endsOn: "2026-02-28" });
});

test("shared stats hold only a summary: streak, this week, recent dates", () => {
  const stats = computeFriendStats(profile, [done("2026-11-10"), done("2026-11-12"), done("2026-08-01"), { ...done("2026-11-11"), sampleData: true }], "2026-11-13");
  assert.equal(stats.displayName, "Priya");
  assert.equal(stats.goal, "tone");
  assert.equal(stats.weekCount, 2);
  assert.equal(stats.weekGoal, 3);
  assert.equal(stats.lastWorkoutDate, "2026-11-12");
  assert.deepEqual(stats.recentDates, ["2026-11-10", "2026-11-12"]);
  assert.equal(stats.currentStreak, 2);
  assert.equal(Object.keys(stats).some((key) => /log|weight|note|load/i.test(key)), false);
});

test("challenge leaderboard counts workouts inside the window and ranks members", () => {
  const challenge: Challenge = { id: "c", creatorId: "me", title: "3 workouts this week", period: "week", target: 3, startsOn: "2026-11-09", endsOn: "2026-11-15", memberIds: ["me", "asha", "ravi"] };
  const stat = (userId: string, displayName: string, recentDates: string[]): FriendStats => ({ userId, displayName, goal: "general", currentStreak: 0, bestStreak: 0, weekCount: 0, weekGoal: 3, lastWorkoutDate: null, recentDates });
  const stats = new Map([
    ["me", stat("me", "Priya", ["2026-11-08", "2026-11-10"])],
    ["asha", stat("asha", "Asha", ["2026-11-09", "2026-11-11", "2026-11-13"])],
  ]);
  assert.equal(challengeProgress(challenge, stats.get("me")!.recentDates), 1);
  const board = challengeLeaderboard(challenge, stats);
  assert.deepEqual(board.map((row) => [row.userId, row.done, row.finished]), [["asha", 3, true], ["me", 1, false], ["ravi", 0, false]]);
  assert.equal(board[0].percent, 100);
  assert.equal(daysLeft(challenge, "2026-11-13"), 3);
});

test("invite codes are 8 characters without look-alikes", () => {
  const code = generateInviteCode((bytes) => bytes.map((_, index) => index * 37));
  assert.equal(code.length, 8);
  assert.ok(isInviteCode(code));
  assert.equal(isInviteCode("ABCD0123"), false);
  assert.equal(isInviteCode("abcd2345"), true);
});

test("last workout labels read naturally", () => {
  assert.equal(lastWorkoutLabel(null, "2026-11-13"), "No workouts yet");
  assert.equal(lastWorkoutLabel("2026-11-13", "2026-11-13"), "Trained today");
  assert.equal(lastWorkoutLabel("2026-11-13", "2026-11-13", true), "today");
  assert.equal(lastWorkoutLabel("2026-11-12", "2026-11-13", true), "yesterday");
  assert.equal(lastWorkoutLabel("2026-11-04", "2026-11-13", true), "9d ago");
  assert.equal(lastWorkoutLabel(null, "2026-11-13", true), "no workouts yet");
  assert.equal(lastWorkoutLabel("2026-11-12", "2026-11-13"), "Trained yesterday");
  assert.equal(lastWorkoutLabel("2026-11-09", "2026-11-13"), "Last trained 4 days ago");
});

const lifted = (date: string, sets: Array<{ kg: number | null; reps: number; kind?: "warmup" | "drop" }>, exerciseId = "goblet-squat"): WorkoutSession => ({
  ...done(date),
  exerciseLogs: [{ exerciseId, status: "completed", plannedSets: sets.length, plannedReps: 8, substitutionName: "", formQuality: "not_rated", notes: "",
    sets: sets.map((set) => ({ extra: false, plannedReps: 8, actualReps: set.reps, loadKg: set.kg, completed: true, ...(set.kind ? { kind: set.kind } : {}) })) }],
} as WorkoutSession);

test("best lifts: the highest estimated one-rep max, never a warm-up; bodyweight counts reps", async () => {
  const { liftBests } = await import("./friends.ts");
  const bests = liftBests([
    lifted("2026-11-10", [{ kg: 60, reps: 10, kind: "warmup" }, { kg: 40, reps: 8 }, { kg: 45, reps: 5 }]),
    lifted("2026-11-12", [{ kg: 42.5, reps: 8 }]),
    lifted("2026-11-11", [{ kg: null, reps: 12 }, { kg: null, reps: 15 }], "push-up"),
  ]);
  // 42.5 × 8 (≈ 53.8) beats 45 × 5 (52.5) and 40 × 8; the 60 kg warm-up is ignored.
  assert.equal(bests["goblet-squat"].kg, 42.5);
  assert.equal(bests["goblet-squat"].reps, 8);
  assert.equal(bests["goblet-squat"].date, "2026-11-12");
  assert.deepEqual(bests["push-up"], { kg: 0, reps: 15, e1rm: null, date: "2026-11-11" });
});

test("lift leaderboard: strongest first, ties share a rank, loaded above bodyweight", async () => {
  const { liftLeaderboard } = await import("./friends.ts");
  const rows = liftLeaderboard("squat", [
    { userId: "me", name: "Me", bests: { squat: { kg: 60, reps: 5, e1rm: 70, date: "2026-11-01" } } },
    { userId: "a", name: "Asha", bests: { squat: { kg: 80, reps: 5, e1rm: 93.3, date: "2026-11-02" } } },
    { userId: "b", name: "Ben", bests: { squat: { kg: 60, reps: 5, e1rm: 70, date: "2026-11-03" } } },
    { userId: "c", name: "Cy", bests: { squat: { kg: 0, reps: 30, e1rm: null, date: "2026-11-03" } } },
    { userId: "d", name: "Dee", bests: {} },
  ], "me");
  assert.deepEqual(rows.map((row) => `${row.rank}:${row.name}`), ["1:Asha", "2:Me", "2:Ben", "4:Cy"]);
  assert.equal(rows[1].you, true);
});

test("sharing best lifts: on by default, off under 18, and the person's choice always wins", async () => {
  const { sharesLifts, computeFriendStats } = await import("./friends.ts");
  assert.equal(sharesLifts({}, "2026-11-17"), true);
  assert.equal(sharesLifts({ birthYear: 2010 }, "2026-11-17"), false);
  assert.equal(sharesLifts({ birthYear: 2010, shareLifts: true }, "2026-11-17"), true);
  assert.equal(sharesLifts({ birthYear: 1990, shareLifts: false }, "2026-11-17"), false);
  const sessions = [lifted("2026-11-12", [{ kg: 40, reps: 8 }])];
  assert.ok(computeFriendStats(profile, sessions, "2026-11-13").liftBests?.["goblet-squat"]);
  assert.deepEqual(computeFriendStats({ ...profile, shareLifts: false }, sessions, "2026-11-13").liftBests, {});
});
