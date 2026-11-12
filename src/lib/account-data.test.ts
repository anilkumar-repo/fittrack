import assert from "node:assert/strict";
import test from "node:test";
import { buildDataExport, isCompleteInviteCode, normalizeInviteCode } from "./account-data.ts";
import { createDemoState } from "./demo-data.ts";
import { generateWorkout } from "./planner.ts";

test("tidies typed trainer codes and accepts only complete ones", () => {
  assert.equal(normalizeInviteCode(" abcd-efgh "), "ABCDEFGH");
  assert.equal(normalizeInviteCode("abcd efgh jk"), "ABCDEFGH");
  assert.equal(isCompleteInviteCode("ABCDEFGH"), true);
  assert.equal(isCompleteInviteCode("ABCDEFG"), false);
  assert.equal(isCompleteInviteCode("ABCDEF01"), false);
});

test("exports the person's own records without account identifiers or sample data", () => {
  const state = createDemoState();
  const plan = generateWorkout({ date: "2026-11-10", profile: { ...state.profile, trainingDays: [2, 4, 6] }, sessions: [] });
  assert.ok(plan);
  const exported = buildDataExport({
    ...state,
    sessions: [
      { id: "a", date: "2026-11-10", status: "planned", plan, exerciseLogs: [] },
      { id: "b", date: "2026-11-03", status: "completed", plan, exerciseLogs: [], sampleData: true },
    ],
    bodyWeightEntries: [{ id: "w", measuredOn: "2026-11-10", weightKg: 61.5 }],
  }, "2026-11-12T00:00:00.000Z");
  assert.equal(exported.workouts.length, 1);
  assert.equal(exported.workouts[0].date, "2026-11-10");
  assert.deepEqual(exported.bodyWeight, [{ measuredOn: "2026-11-10", weightKg: 61.5 }]);
  assert.equal("id" in exported.profile, false);
  assert.equal(exported.storedIn, "this device only");
});
