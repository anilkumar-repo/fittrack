import assert from "node:assert/strict";
import test from "node:test";
import { generateWorkout } from "./planner.ts";
import { regionsForExercises } from "./figure.ts";
import { focusRegions, FOCUS_OPTIONS, gymPreset, GYM_OPTIONS } from "./onboarding.ts";
import type { Profile, WorkoutPlan } from "./types";

const base: Profile = {
  id: "p1", displayName: "Sam", experience: "intermediate", sessionsPerWeek: 3, trainingDays: [1, 3, 5],
  trainingStartDate: "2026-09-01", timeZone: "Asia/Kolkata", deadliftEnabled: false, trainerRole: false,
  preferredSessionMinutes: 40, equipmentAvailability: "verified", availableEquipment: gymPreset("large_gym"), goal: "muscle",
};

function setsOn(plan: WorkoutPlan, regions: string[]): number {
  return plan.exercises.filter((exercise) => regionsForExercises([exercise]).some((region) => regions.includes(region))).reduce((sum, exercise) => sum + exercise.sets, 0);
}

test("gym type presets equipment; every focus has a label", () => {
  assert.deepEqual(gymPreset("bodyweight"), []);
  assert.ok(gymPreset("large_gym").length > gymPreset("small_gym").length);
  assert.ok(gymPreset("home").includes("dumbbells"));
  assert.equal(GYM_OPTIONS.length, 4);
  assert.deepEqual(focusRegions("balanced"), []);
  assert.deepEqual(focusRegions(undefined), []);
  for (const option of FOCUS_OPTIONS) assert.ok(option.label);
});

test("a focus muscle adds one set to moves that train it, and says so; recovery weeks stay light", () => {
  // Week 23, Push A: chest focus adds a set to each chest move and leaves the rest alone.
  const balanced = generateWorkout({ date: "2026-11-16", profile: base, sessions: [] }) as WorkoutPlan;
  const chest = generateWorkout({ date: "2026-11-16", profile: { ...base, focusArea: "chest" }, sessions: [] }) as WorkoutPlan;
  assert.equal(balanced.recoveryWeek, false);
  for (const [index, exercise] of balanced.exercises.entries()) {
    const trainsChest = regionsForExercises([exercise]).includes("chest");
    assert.equal(chest.exercises[index].sets, exercise.sets + (trainsChest ? 1 : 0), exercise.name);
  }
  assert.ok(chest.generationReasons.some((reason) => reason.includes("focus is chest")));
  assert.ok(setsOn(chest, ["chest"]) > setsOn(balanced, ["chest"]));
  // Week 24 is a conditioning (recovery) week: no extra sets.
  const light = generateWorkout({ date: "2026-11-18", profile: { ...base, focusArea: "legs" }, sessions: [] }) as WorkoutPlan;
  const lightBalanced = generateWorkout({ date: "2026-11-18", profile: base, sessions: [] }) as WorkoutPlan;
  assert.equal(light.recoveryWeek, true);
  assert.deepEqual(light.exercises.map((exercise) => exercise.sets), lightBalanced.exercises.map((exercise) => exercise.sets));
});
