import assert from "node:assert/strict";
import test from "node:test";
import { estimateOneRepMax, exerciseHistory, exerciseRecords, platesPerSide, repMaxTable, routinePlan, setLabels, validateRoutine, warmUpSets } from "./pro-tracking.ts";
import type { WorkoutSession } from "./types";

test("set labels: W, D and F letters; working sets numbered among themselves", () => {
  assert.deepEqual(setLabels([{ kind: "warmup" }, { kind: "warmup" }, {}, {}, { kind: "drop" }, { kind: "failure" }]), ["W", "W", "1", "2", "D", "F"]);
  assert.deepEqual(setLabels([{}, {}, {}]), ["1", "2", "3"]);
});

test("estimated one-rep max and the rep-max table", () => {
  assert.equal(estimateOneRepMax(100, 1), 100);
  assert.equal(estimateOneRepMax(100, 5), 116.7);
  assert.equal(estimateOneRepMax(100, 15), null);
  assert.equal(estimateOneRepMax(0, 5), null);
  const table = repMaxTable(120);
  assert.equal(table.length, 10);
  assert.equal(table[0].loadKg, 120);
  assert.ok(table[9].loadKg < table[4].loadKg);
});

test("plates per side, and what's left when plates can't make the weight", () => {
  assert.deepEqual(platesPerSide(100), { perSide: [25, 15], totalKg: 100, shortKg: 0 });
  assert.deepEqual(platesPerSide(62.5).perSide, [20, 1.25]);
  assert.equal(platesPerSide(62.5).totalKg, 62.5);
  assert.deepEqual(platesPerSide(20).perSide, []);
  assert.equal(platesPerSide(21).shortKg, 1);
});

test("warm-up sets build to the working weight", () => {
  assert.deepEqual(warmUpSets(100), [{ loadKg: 40, reps: 10, percent: 40 }, { loadKg: 60, reps: 6, percent: 60 }, { loadKg: 80, reps: 3, percent: 80 }]);
  assert.deepEqual(warmUpSets(0), []);
  // Light weights don't get pointless duplicate warm-ups.
  assert.ok(warmUpSets(5).length <= 2);
});

function day(date: string, sets: Array<[number, number | null, ("warmup" | "drop" | "failure")?]>, status: WorkoutSession["status"] = "completed"): WorkoutSession {
  return { id: date, date, status, plan: { exercises: [] }, exerciseLogs: [{ exerciseId: "bench", plannedSets: 3, plannedReps: 8, status: "completed", substitutionName: "", formQuality: "sound", notes: "",
    sets: sets.map(([reps, loadKg, kind]) => ({ plannedReps: 8, actualReps: reps, loadKg, completed: true, extra: false, ...(kind ? { kind } : {}) })) }] } as unknown as WorkoutSession;
}

test("exercise history and records ignore warm-ups and unfinished days", () => {
  const sessions = [
    day("2026-11-10", [[10, 40, "warmup"], [8, 60], [8, 60]]),
    day("2026-11-13", [[10, 40, "warmup"], [6, 70], [5, 70], [12, 50, "drop"]]),
    day("2026-11-14", [[8, 80]], "planned"),
  ];
  const history = exerciseHistory(sessions, "bench");
  assert.deepEqual(history.map((entry) => entry.date), ["2026-11-13", "2026-11-10"]);
  assert.deepEqual(history[0].best, { reps: 6, loadKg: 70 });
  assert.equal(history[1].volumeKg, 960);
  const records = exerciseRecords(history);
  assert.deepEqual(records.heaviest, { loadKg: 70, reps: 6, date: "2026-11-13" });
  assert.equal(records.bestOneRepMax?.value, 84);
  assert.equal(records.mostReps?.reps, 12);
  assert.equal(records.sessions, 2);
});

test("routines validate and turn into a normal plan", () => {
  assert.deepEqual(validateRoutine({ name: "", exercises: [] }), ["Give your routine a name.", "Add at least one exercise."]);
  const routine = { id: "r1", name: "Push day", updatedAt: "", exercises: [{ exerciseId: "goblet_squat", sets: 3, reps: "8–12" }] };
  assert.deepEqual(validateRoutine(routine), []);
  const plan = routinePlan(routine, "2026-11-17");
  assert.equal(plan.title, "Push day");
  assert.equal(plan.focus, "Your routine");
  assert.equal(plan.exercises[0].sets, 3);
  assert.equal(plan.exercises[0].reps, "8–12");
  assert.ok(plan.durationMinutes >= 10);
});
