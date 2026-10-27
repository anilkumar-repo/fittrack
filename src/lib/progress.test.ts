import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { generateWorkout } from "./planner.ts";
import { bodyWeightTrend, buildExercisePerformance, buildProgressTimeline, calculateConsistency, calculatePersonalRecords, calculateRecoveryMetrics, canAccessOwnerProgress, createProgressDateRange, recordedSessionStatus, upsertBodyWeightEntry, validateBodyWeightEntry } from "./progress.ts";
import { createExerciseLog } from "./workout-tracking.ts";
import type { CheckIn, ExerciseLog, Profile, WorkoutPlan, WorkoutSession } from "./types";

const profile: Profile = {
  id: "owner-a", displayName: "Maya", experience: "beginner", sessionsPerWeek: 3,
  trainingDays: [2, 4, 6], trainingStartDate: "2026-10-10", timeZone: "Asia/Kolkata", deadliftEnabled: false,
  trainerRole: false, preferredSessionMinutes: 40, equipmentAvailability: "unknown", availableEquipment: [],
};

const checkIn: CheckIn = { energy: 4, soreness: 2, pain: false, recovery: 4, discomfort: "", note: "" };

function session(date: string, status: WorkoutSession["status"] = "completed", logs: ExerciseLog[] = [], overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  let plan: WorkoutPlan | null = null;
  for (let offset = 0; offset < 7 && !plan; offset += 1) {
    const candidate = new Date(`${date}T12:00:00Z`);
    candidate.setUTCDate(candidate.getUTCDate() + offset);
    const candidateDate = candidate.toISOString().slice(0, 10);
    plan = generateWorkout({ date: candidateDate, profile, sessions: [] });
  }
  assert.ok(plan);
  plan = { ...plan, date };
  return {
    id: `session-${date}`, date, status, plan, exerciseLogs: logs, checkIn,
    review: { effort: 5, mood: "same", energyAfter: 3, discomfort: false, discomfortNote: "", note: "" },
    ...overrides,
  };
}

function exerciseLog(exerciseId: string, actualReps: Array<number | null>, loads: Array<number | null>, completed = true): ExerciseLog {
  return {
    ...createExerciseLog(exerciseId, 3, 10),
    status: completed ? "completed" : "partial",
    formQuality: "sound",
    sets: actualReps.map((reps, index) => ({ plannedReps: 10, actualReps: reps, loadKg: loads[index] ?? null, completed: completed && reps !== null, extra: false })),
  };
}

test("date window is inclusive and validates real calendar dates", () => {
  assert.deepEqual(createProgressDateRange("2026-10-27"), { startDate: "2026-09-30", endDate: "2026-10-27" });
  assert.deepEqual(createProgressDateRange("2026-01-01", 1), { startDate: "2026-01-01", endDate: "2026-01-01" });
  assert.equal(createProgressDateRange("2026-02-29"), null);
  assert.equal(createProgressDateRange("2026-10-27", 0), null);
});

test("consistency counts only explicitly completed scheduled dates within range and after training start", () => {
  const completedA = session("2026-10-13");
  const completedB = session("2026-10-22");
  const partial = session("2026-10-24", "in_progress", [exerciseLog("squat", [8, null], [null, null], false)]);
  const skipped = session("2026-10-20", "skipped");
  const planned = session("2026-10-27", "planned");
  const tooEarly = session("2026-10-06");
  const future = session("2026-10-29");
  const result = calculateConsistency(profile, [completedA, completedB, partial, skipped, planned, tooEarly, future], "2026-10-27");
  assert.equal(result?.scheduledDays, 8);
  assert.equal(result?.completedScheduledDays, 2);
  assert.equal(result?.percent, 25);
  assert.equal(calculateConsistency({ ...profile, trainingDays: [] }, [], "2026-10-27")?.percent, null);
});

test("timeline distinguishes rest, not-started, unrecorded, saved and partial days", () => {
  const activeProfile = { ...profile, trainingStartDate: "2026-10-26" };
  const partial = session("2026-10-27", "in_progress", [exerciseLog("squat", [8, null], [null, null], false)]);
  const timeline = buildProgressTimeline(activeProfile, [partial], "2026-10-27", 4);
  assert.deepEqual(timeline.map((day) => day.status), ["not_started", "not_started", "rest_day", "partial"]);
  const rest = buildProgressTimeline(activeProfile, [], "2026-10-25", 1)[0];
  assert.equal(rest.status, "not_started");
  const scheduledRest = buildProgressTimeline({ ...activeProfile, trainingStartDate: "2026-10-01" }, [], "2026-10-25", 1)[0];
  assert.equal(scheduledRest.status, "rest_day");
});

test("performance uses actual completed sets and keeps prescribed targets separate", () => {
  const plan = generateWorkout({ date: "2026-10-27", profile, sessions: [] }) as WorkoutPlan;
  const exerciseId = plan.exercises[0].id;
  const logged = exerciseLog(exerciseId, [8, 10, null], [12, null, null], false);
  logged.status = "partial";
  logged.sets[0].completed = true;
  const records = buildExercisePerformance([session("2026-10-27", "in_progress", [logged]), session("2026-10-28", "planned", [logged])]);
  assert.equal(records.length, 1);
  assert.equal(records[0].records.length, 1);
  assert.equal(records[0].records[0].plannedSets, 3);
  assert.equal(records[0].records[0].plannedReps, 10);
  assert.equal(records[0].records[0].completedSets, 1);
  assert.equal(records[0].records[0].completedReps, 8);
  assert.equal(records[0].records[0].heaviestRecordedLoadKg, 12);
  assert.equal(records[0].records[0].sets[1].actualReps, 10);
});

test("empty or skipped history never creates exercise trends or records", () => {
  assert.deepEqual(buildExercisePerformance([]), []);
  assert.deepEqual(calculatePersonalRecords([]), []);
  const plan = generateWorkout({ date: "2026-10-27", profile, sessions: [] }) as WorkoutPlan;
  const log = exerciseLog(plan.exercises[0].id, [10], [100], false);
  log.status = "skipped";
  assert.deepEqual(buildExercisePerformance([session("2026-10-27", "skipped", [log])]), []);
  const unweighted = exerciseLog(plan.exercises[0].id, [10], [null]);
  assert.deepEqual(calculatePersonalRecords([session("2026-10-27", "completed", [unweighted])]), []);
});

test("personal records use the heaviest actual completed positive-load set, not estimated values", () => {
  const plan = generateWorkout({ date: "2026-10-27", profile, sessions: [] }) as WorkoutPlan;
  const id = plan.exercises[0].id;
  const first = exerciseLog(id, [8, 12], [10, 14]);
  const later = exerciseLog(id, [6], [14]);
  const uncompleted = exerciseLog(id, [10], [200], false);
  const records = calculatePersonalRecords([
    session("2026-10-13", "completed", [first]),
    session("2026-10-22", "completed", [later]),
    session("2026-10-24", "in_progress", [uncompleted]),
  ]);
  assert.equal(records.length, 1);
  assert.equal(records[0].loadKg, 14);
  assert.equal(records[0].reps, 6);
  assert.equal(records[0].date, "2026-10-22");
});

test("substitution performance and records are attributed to the logged substitute name", () => {
  const plan = generateWorkout({ date: "2026-10-27", profile, sessions: [] }) as WorkoutPlan;
  const log = exerciseLog(plan.exercises[0].id, [9], [8]);
  log.substitutionName = "Chair squat";
  const result = buildExercisePerformance([session("2026-10-27", "completed", [log])]);
  assert.equal(result[0].exerciseName, "Chair squat");
  assert.equal(result[0].exerciseId, "substitution:chair squat");
  assert.equal(calculatePersonalRecords([session("2026-10-27", "completed", [log])])[0].exerciseName, "Chair squat");
});

test("recovery summaries use only recorded check-ins and feedback in the inclusive range", () => {
  const inRange = session("2026-10-27", "completed", [], { checkIn: { ...checkIn, energy: 5, soreness: 3, pain: true }, review: { effort: 6, mood: "same", energyAfter: 2, discomfort: true, discomfortNote: "", note: "" } });
  const inRange2 = session("2026-09-30", "completed", [], { checkIn: { ...checkIn, energy: 3, soreness: 1 }, review: undefined });
  const outside = session("2026-09-29", "completed", [], { checkIn: { ...checkIn, energy: 1, soreness: 5, pain: true } });
  const metrics = calculateRecoveryMetrics([inRange, inRange2, outside], "2026-10-27");
  assert.equal(metrics?.checkInCount, 2);
  assert.equal(metrics?.averageEnergy, 4);
  assert.equal(metrics?.averageSoreness, 2);
  assert.equal(metrics?.averageEnergyAfter, 2);
  assert.equal(metrics?.painCheckIns, 1);
  assert.equal(metrics?.postWorkoutDiscomfortReports, 1);
  const empty = calculateRecoveryMetrics([], "2026-10-27");
  assert.equal(empty?.averageEnergy, null);
  assert.equal(empty?.checkInCount, 0);
});

test("body-weight validation, same-date edits and ordered trend are explicit", () => {
  assert.deepEqual(validateBodyWeightEntry("2026-10-27", 54.25, "2026-10-27"), []);
  assert.ok(validateBodyWeightEntry("2026-10-28", 54, "2026-10-27").length);
  assert.ok(validateBodyWeightEntry("2026-10-27", 54.256, "2026-10-27").length);
  const one = { id: "one", measuredOn: "2026-10-20", weightKg: 55 };
  const edited = { id: "two", measuredOn: "2026-10-20", weightKg: 54.5 };
  const entries = upsertBodyWeightEntry([one, { id: "old", measuredOn: "2026-10-15", weightKg: 56 }], edited);
  assert.equal(entries.length, 2);
  assert.deepEqual(bodyWeightTrend(entries), [{ date: "2026-10-15", weightKg: 56 }, { date: "2026-10-20", weightKg: 54.5 }]);
});

test("progress owner access is limited to the authenticated owner", () => {
  assert.equal(canAccessOwnerProgress("owner-a", "owner-a"), true);
  assert.equal(canAccessOwnerProgress("trainer-b", "owner-a"), false);
  assert.equal(canAccessOwnerProgress("", "owner-a"), false);
  const migration = readFileSync(new URL("../../supabase/migrations/20261027162809_20261027153903_phase_5_progress_tracking.sql", import.meta.url), "utf8");
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /using \(\(select auth\.uid\(\)\) = user_id\)/i);
  assert.match(migration, /with check \(\(select auth\.uid\(\)\) = user_id\)/i);
  assert.match(migration, /grant select, insert, update on public\.body_weight_entries to authenticated/i);
  assert.doesNotMatch(migration, /create policy .*trainer/i);
});

test("automatic beginner plan still cannot introduce deadlift variations", () => {
  const plan = generateWorkout({ date: "2026-10-27", profile: { ...profile, deadliftEnabled: false }, sessions: [] });
  assert.ok(plan);
  assert.equal(plan.exercises.some((exercise) => /deadlift/i.test(exercise.name)), false);
});

test("saved session status remains honest for incomplete work", () => {
  const plan = generateWorkout({ date: "2026-10-27", profile, sessions: [] }) as WorkoutPlan;
  const partial = session("2026-10-27", "in_progress", [exerciseLog(plan.exercises[0].id, [8, null], [null, null], false)]);
  assert.equal(recordedSessionStatus(partial), "partial");
  assert.equal(recordedSessionStatus(session("2026-10-27", "planned")), "planned");
  assert.equal(recordedSessionStatus(session("2026-10-27", "skipped")), "skipped");
});
