import assert from "node:assert/strict";
import test from "node:test";
import { compareVariation, variationsOf } from "./exercise-variations.ts";
import { VARIATION_NOTES } from "./exercise-taxonomy.ts";
import { getSafeExerciseAlternatives } from "./exercise-library.ts";
import { swapChoices } from "./exercise-swap.ts";
import { getExerciseDefinition } from "./templates.ts";
import { runRoziTool, roziContext } from "./rozi-ai/tools.ts";
import type { Profile } from "./types.ts";

// R7: Rozi understands exercise variations from library data, not guesses.

const profile: Profile = {
  id: "client", displayName: "Client", experience: "beginner", sessionsPerWeek: 3, trainingDays: [1, 3, 5], trainingStartDate: "2026-01-01",
  timeZone: "Asia/Kolkata", deadliftEnabled: false, trainerRole: false, preferredSessionMinutes: 45, equipmentAvailability: "verified",
  availableEquipment: ["dumbbells", "bench"],
};
const get = (id: string) => getExerciseDefinition(id)!;

test("every variation note belongs to an exercise in a variation group", () => {
  for (const id of Object.keys(VARIATION_NOTES)) {
    assert.ok(get(id), `${id} exists`);
    assert.ok(get(id).variationGroup, `${id} is in a variation group`);
  }
});

test("differences come from the data: muscles, equipment, difficulty, sides, units, approval", () => {
  assert.deepEqual(compareVariation(get("dumbbell_bench"), get("incline_db_press")), ["inclined bench: more upper chest"]);
  assert.deepEqual(compareVariation(get("dumbbell_bench"), get("db_floor_press")), ["shorter range, easy on the shoulders", "no bench needed"]);
  assert.deepEqual(compareVariation(get("dumbbell_bench"), get("barbell_bench")), ["needs barbell / ez bar", "harder (intermediate)"]);
  assert.deepEqual(compareVariation(get("pullup"), get("chinup")), ["palms facing you: more biceps"]);
  assert.ok(compareVariation(get("glute_bridge"), get("single_leg_glute_bridge")).includes("one side at a time"));
  assert.ok(compareVariation(get("goblet_squat"), get("wall_sit")).includes("counted in seconds"));
  assert.ok(compareVariation(get("dumbbell_rdl"), get("single_leg_rdl")).includes("one side at a time"));
  assert.ok(compareVariation(get("glute_bridge"), get("barbell_hip_thrust")).every((fact) => !fact.includes("approval")));
});

test("variations list the other versions, closest first, with what this person can do", () => {
  const list = variationsOf(get("dumbbell_bench"), profile);
  assert.equal(list[0].exercise.id, "barbell_bench", "group order");
  assert.ok(!list.some((item) => item.exercise.id === "dumbbell_bench"), "not itself");
  assert.equal(list.find((item) => item.exercise.id === "incline_db_press")?.usable, true);
  assert.equal(list.find((item) => item.exercise.id === "barbell_bench")?.usable, false);
  assert.deepEqual(variationsOf(get("db_shrug"), profile), [], "no group, no variations");
});

test("Rozi's exercise info includes the variations", () => {
  const ctx = roziContext({ profile, sessions: [], bodyWeightEntries: [] } as never, "2026-11-24", 10);
  const outcome = runRoziTool("get_exercise_info", { exercise: "dumbbell bench press" }, ctx);
  const variations = (outcome.result as { variations: Array<{ name: string; youCanDoIt: boolean; differences: string[] }> }).variations;
  assert.ok(variations.length > 0 && variations.length <= 6);
  assert.deepEqual(variations.find((item) => item.name === "Incline dumbbell press"), { name: "Incline dumbbell press", youCanDoIt: true, differences: ["inclined bench: more upper chest"] });
});

test("swaps and alternatives list versions of the same movement first", () => {
  const bench = get("dumbbell_bench");
  const choices = swapChoices(bench, profile, [bench]);
  // The exercise's own fallback (push-up) stays first; then versions of the same movement.
  assert.equal(choices.suggested[0]?.id, bench.fallbackId);
  assert.equal(choices.suggested[1]?.variationGroup, "bench_press");
  // In the longer list, a version of the movement ranks above other exercises (barbell press shown first at a full gym).
  const gym: Profile = { ...profile, availableEquipment: ["dumbbells", "bench", "barbell", "rack", "gym_machines"] };
  const gymChoices = swapChoices(bench, gym, [bench]);
  assert.equal(gymChoices.others[0]?.variationGroup, "bench_press");
  const alternatives = getSafeExerciseAlternatives(get("goblet_squat"), { ...profile, availableEquipment: [] });
  assert.equal(alternatives[0]?.id, "bodyweight_squat", "fallback first");
});
