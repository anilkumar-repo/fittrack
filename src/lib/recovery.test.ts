import assert from "node:assert/strict";
import test from "node:test";
import { muscleRecovery, readyCount, recoveryLine, weeklyReport } from "./recovery.ts";
import type { WorkoutSession } from "./types";

function session(date: string, moves: Array<[string, string, number, number?]>, extra: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: `s-${date}`, date, status: "completed",
    plan: { exercises: moves.map(([id, pattern]) => ({ id, name: id, movementPattern: pattern })), durationMinutes: 40 },
    exerciseLogs: moves.map(([id, , sets, load]) => ({ exerciseId: id, plannedSets: sets, plannedReps: 8, status: "completed", substitutionName: "", formQuality: "sound", notes: "",
      sets: Array.from({ length: sets }, () => ({ plannedReps: 8, actualReps: 8, loadKg: load ?? null, completed: true, extra: false })) })),
    ...extra,
  } as unknown as WorkoutSession;
}

const profile = { trainingDays: [1, 3, 5], trainingStartDate: "2026-11-01", sessionsPerWeek: 3 };

test("nothing logged: every muscle is 'not trained yet' and counts as ready", () => {
  const recovery = muscleRecovery([], "2026-11-18");
  assert.equal(recovery.length, 6);
  assert.ok(recovery.every((item) => item.status === "no_data"));
  assert.equal(readyCount(recovery), 6);
  assert.match(recoveryLine(recovery), /first workout/);
});

test("chest pressed yesterday is fresh, then recovering, then ready; legs untouched stay ready", () => {
  const sessions = [session("2026-11-17", [["press", "horizontal_push", 3, 40]])];
  const day1 = muscleRecovery(sessions, "2026-11-18");
  const chest = day1.find((item) => item.group === "chest")!;
  assert.equal(chest.status, "fresh");
  assert.equal(chest.lastSets, 3);
  assert.equal(chest.readyOn, "2026-11-19");
  assert.equal(day1.find((item) => item.group === "legs")!.status, "no_data");
  assert.equal(muscleRecovery(sessions, "2026-11-19").find((item) => item.group === "chest")!.status, "ready");
  // A big session (6+ sets) needs a third day.
  const big = [session("2026-11-17", [["press", "horizontal_push", 6, 40]])];
  assert.equal(muscleRecovery(big, "2026-11-19").find((item) => item.group === "chest")!.status, "recovering");
  assert.equal(muscleRecovery(big, "2026-11-20").find((item) => item.group === "chest")!.status, "ready");
  assert.match(recoveryLine(day1), /Chest/);
});

test("reported soreness marks the trained muscles sore; skipped or planned days don't count", () => {
  const sore = [session("2026-11-17", [["squat", "squat", 3]], { checkIn: { energy: 3, soreness: 5, pain: false, recovery: 2, discomfort: "", note: "" } })];
  assert.equal(muscleRecovery(sore, "2026-11-18").find((item) => item.group === "legs")!.status, "sore");
  assert.match(recoveryLine(muscleRecovery(sore, "2026-11-18")), /soreness/);
  const notDone = [session("2026-11-17", [["squat", "squat", 3]], { status: "planned" }), session("2026-11-16", [["squat", "squat", 3]], { status: "skipped" })];
  assert.ok(muscleRecovery(notDone, "2026-11-18").every((item) => item.status === "no_data"));
});

test("weekly report counts only saved work and finds new records", () => {
  const sessions = [
    session("2026-11-09", [["press", "horizontal_push", 3, 40]]),
    session("2026-11-16", [["press", "horizontal_push", 3, 45], ["squat", "squat", 3, 60]], { checkIn: { energy: 4, soreness: 2, pain: false, recovery: 4, discomfort: "", note: "" } }),
    session("2026-11-18", [["squat", "squat", 2, 60]], { status: "skipped", missedReason: { reason: "busy", note: "" }, exerciseLogs: [] }),
  ];
  const report = weeklyReport(profile, sessions, "2026-11-16", "2026-11-22");
  assert.equal(report.weekEnd, "2026-11-22");
  assert.equal(report.planned, 3);
  assert.equal(report.completed, 1);
  assert.equal(report.skipped, 1);
  assert.equal(report.consistency, 33);
  assert.equal(report.sets, 6);
  assert.equal(report.volumeKg, 3 * 8 * 45 + 3 * 8 * 60);
  assert.equal(report.groupSets.chest, 3);
  assert.equal(report.groupSets.legs, 3);
  assert.deepEqual(report.newRecords.map((record) => [record.exerciseId, record.loadKg]).sort(), [["press", 45], ["squat", 60]]);
  assert.equal(report.avgEnergy, 4);
  assert.deepEqual(report.missedReasons, ["busy"]);
  assert.match(report.rozi, /1 workout done, 2 new records/);
});
