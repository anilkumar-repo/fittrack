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
  assert.equal(lastWorkoutLabel("2026-11-12", "2026-11-13"), "Trained yesterday");
  assert.equal(lastWorkoutLabel("2026-11-09", "2026-11-13"), "Last trained 4 days ago");
});
