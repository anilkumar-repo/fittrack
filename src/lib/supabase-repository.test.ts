import assert from "node:assert/strict";
import test from "node:test";
import { accountProfile } from "./supabase-repository.ts";
import { createDemoState } from "./demo-data.ts";

const local = {
  ...createDemoState().profile, displayName: "AR", heightCm: 170, birthYear: 1999, sex: "male" as const, why: "Get stronger · More energy",
  focusArea: "chest" as const, gymType: "small_gym" as const, goal: "muscle" as const, experience: "intermediate" as const, sessionsPerWeek: 5, trainingDays: [1, 2, 3, 4, 5],
};

test("a brand-new account keeps every Get started answer (no second body-details prompt)", () => {
  const profile = accountProfile(null, { id: "new-user", email: "x@example.com" }, false, false, { profile: local, onboarded: true });
  assert.equal(profile.id, "new-user");
  assert.equal(profile.displayName, "AR");
  assert.equal(profile.heightCm, 170);
  assert.equal(profile.birthYear, 1999);
  assert.equal(profile.sex, "male");
  assert.equal(profile.why, "Get stronger · More energy");
  assert.equal(profile.focusArea, "chest");
  assert.equal(profile.gymType, "small_gym");
  assert.equal(profile.goal, "muscle");
  assert.equal(profile.experience, "intermediate");
  assert.deepEqual(profile.trainingDays, [1, 2, 3, 4, 5]);
  assert.equal(profile.trainerRole, false);
});

test("an existing account loads its saved profile, not this phone's answers", () => {
  const profile = accountProfile({ display_name: "Saved", height_cm: 180, birth_year: 1990, why: "x", goal: "tone", sessions_per_week: 3, training_days: [1, 3, 5] }, { id: "old-user" }, false, false, { profile: local, onboarded: true });
  assert.equal(profile.displayName, "Saved");
  assert.equal(profile.heightCm, 180);
  assert.equal(profile.goal, "tone");
  assert.deepEqual(profile.trainingDays, [1, 3, 5]);
});
