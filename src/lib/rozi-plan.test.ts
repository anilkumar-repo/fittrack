import assert from "node:assert/strict";
import test from "node:test";
import { planMinutes, planTarget, planWorkout } from "./rozi-plan.ts";
import { detectIntent } from "./rozi-chat.ts";
import { validateRoutine } from "./pro-tracking.ts";
import { EQUIPMENT_OPTIONS, getExerciseDefinition } from "./templates.ts";
import { createDemoState } from "./demo-data.ts";
import type { Profile } from "./types";

const base: Profile = { ...createDemoState().profile, experience: "beginner", goal: "muscle", preferredSessionMinutes: 45, equipmentAvailability: "unknown", availableEquipment: [], deadliftEnabled: false };
const gym: Profile = { ...base, experience: "pro", equipmentAvailability: "verified", availableEquipment: EQUIPMENT_OPTIONS.map((item) => item.id) };

test("Rozi recognises a request to plan a workout (and still answers the old questions)", () => {
  assert.equal(detectIntent("can you plan me leg workout"), "PLAN_WORKOUT");
  assert.equal(detectIntent("Give me a 30 min chest workout"), "PLAN_WORKOUT");
  assert.equal(detectIntent("build a push day"), "PLAN_WORKOUT");
  assert.equal(detectIntent("arm day please"), "PLAN_WORKOUT");
  assert.equal(detectIntent("I need a rest day"), "UNKNOWN");
  assert.equal(detectIntent("What’s my workout today?"), "TODAY_WORKOUT");
  assert.equal(detectIntent("Show my last workout"), "LAST_WORKOUT");
});

test("what and how long", () => {
  assert.equal(planTarget("plan me leg workout"), "legs");
  assert.equal(planTarget("glute focus please"), "glutes");
  assert.equal(planTarget("upper body day"), "upper");
  assert.equal(planTarget("biceps and triceps"), "arms");
  assert.equal(planTarget("plan a workout"), "full");
  assert.equal(planMinutes("30 min chest"), 30);
  assert.equal(planMinutes("an hour"), 60);
  assert.equal(planMinutes("5 min"), null);
  assert.equal(planMinutes("200 minutes"), 90);
});

test("a beginner without equipment gets bodyweight leg moves, 2 sets", () => {
  const plan = planWorkout("plan me leg workout", base);
  assert.ok(plan);
  assert.equal(plan.target, "legs");
  assert.ok(plan.routine.exercises.length >= 3 && plan.routine.exercises.length <= 7);
  for (const item of plan.routine.exercises) {
    const exercise = getExerciseDefinition(item.exerciseId)!;
    assert.deepEqual(exercise.requiredEquipment ?? [], [], `${exercise.name} needs no equipment`);
    assert.ok(["squat", "single_leg", "hip_extension", "hamstring_curl", "knee_extension", "calf_raise"].includes(String(exercise.movementPattern)), exercise.name);
  }
  assert.equal(plan.routine.exercises[0].sets, 2);
  assert.match(plan.note, /Bodyweight/);
  assert.deepEqual(validateRoutine(plan.routine), [], "can be saved as a routine");
});

test("a pro in a full gym gets loaded, harder moves and 4 sets on the big lifts; never a deadlift without approval", () => {
  const plan = planWorkout("30 min leg day", gym);
  assert.ok(plan);
  assert.equal(plan.minutes, 30);
  assert.equal(plan.routine.exercises[0].sets, 4);
  const names = plan.routine.exercises.map((item) => getExerciseDefinition(item.exerciseId)!.name);
  assert.ok(names.some((name) => /barbell squat|bulgarian/i.test(name)), names.join(", "));
  assert.ok(!names.some((name) => /deadlift/i.test(name)), "no deadlift without trainer approval");
  assert.equal(plan.routine.exercises.length, 4);
  assert.deepEqual(validateRoutine(plan.routine), []);
});

test("every area can be planned and saved", () => {
  for (const ask of ["chest", "back", "shoulders", "arms", "push", "pull", "upper body", "lower body", "full body", "core", "glutes"]) {
    const plan = planWorkout(`plan a ${ask} workout`, gym);
    assert.ok(plan && plan.routine.exercises.length >= 3, ask);
    assert.deepEqual(validateRoutine(plan.routine), [], ask);
    assert.equal(new Set(plan.routine.exercises.map((item) => item.exerciseId)).size, plan.routine.exercises.length, `${ask}: no repeats`);
  }
});
