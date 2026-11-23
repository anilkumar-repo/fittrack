import assert from "node:assert/strict";
import test from "node:test";
import { EQUIPMENT_OPTIONS, EXERCISE_LIBRARY, getExerciseDefinition } from "./templates.ts";
import { EQUIPMENT_ALTERNATIVES, EXERCISE_ALIASES, muscleKey, TARGET_MUSCLE_LABELS, VARIATION_GROUPS } from "./exercise-taxonomy.ts";
import { exerciseEquipmentIsAvailable, exerciseSearchRank, filterExerciseLibrary, getExerciseLibraryFilterOptions, MOVEMENT_PATTERN_LABELS } from "./exercise-library.ts";
import { GYM_OPTIONS } from "./onboarding.ts";
import { canUseExercise, findNamedExercise, swapChoices } from "./exercise-swap.ts";
import { BATCH_A_UPPER, BATCH_B_LOWER_CORE, NOT_AUTO_PICKED } from "./library-additions.ts";
import { isTrainerEditableTemplateExercise } from "./trainer-rules.ts";
import { regionsForExercises } from "./figure.ts";
import { findExercise } from "./rozi-ai/tools.ts";
import type { Profile } from "./types.ts";

// Library quality checks (R3). They guard the IDs saved in plans, routines, logs and Rozi actions, and keep the
// structured data (muscles, aliases, variation groups) consistent as exercises are added.

const norm = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const ids = new Set(EXERCISE_LIBRARY.map((exercise) => exercise.id));

/** IDs that saved data already points to. Removing or renaming one breaks old plans and logs. */
const KNOWN_IDS = ["goblet_squat", "dumbbell_bench", "lat_pulldown", "glute_bridge", "dead_bug", "leg_press", "seated_row", "shoulder_press",
  "hamstring_curl", "plank", "split_squat", "incline_pushup", "chest_row", "hip_thrust", "farmer_carry", "dumbbell_rdl", "bodyweight_squat",
  "sit_to_stand", "wall_pushup", "prone_lat_pull", "prone_w_raise", "wall_slide", "heel_dig_bridge", "wall_plank", "bodyweight_split_squat",
  "prone_y_raise", "march_in_place", "comfortable_walk", "relaxed_breathing", "barbell_bench", "incline_db_press", "machine_shoulder_press",
  "lateral_raise", "cable_lateral_raise", "cable_fly", "pec_deck", "dumbbell_fly", "triceps_pushdown", "rope_pushdown", "overhead_cable_extension",
  "db_triceps_extension", "pushup", "barbell_row", "face_pull", "single_arm_cable_row", "one_arm_db_row", "straight_arm_pulldown", "assisted_pullup",
  "ez_curl", "db_curl", "hammer_curl", "preacher_curl", "incline_db_curl", "reverse_curl", "wrist_curl", "reverse_wrist_curl", "back_squat",
  "smith_squat", "hack_squat", "bulgarian_split_squat", "reverse_lunge", "step_up", "leg_extension", "calf_raise", "db_glute_bridge",
  "slider_leg_curl", "back_extension", "barbell_rdl", "floor_plank", "side_plank", "bird_dog", "pallof_press", "cable_crunch",
  "hanging_knee_raise", "reverse_crunch", "interval_cardio", "easy_cardio",
  // R6 batch A (2026-11-23)
  "machine_chest_press", "barbell_incline_bench", "close_grip_bench", "db_floor_press", "knee_pushup", "pullup", "chinup", "machine_row",
  "inverted_row", "band_row", "conventional_deadlift", "db_shrug", "barbell_ohp", "pike_pushup", "reverse_db_fly", "reverse_pec_deck",
  "band_pull_apart", "cable_curl", "band_curl", "skull_crusher", "bench_dips", "dead_hang",
  // R6 batch B (2026-11-23)
  "walking_lunge", "wall_sit", "single_leg_rdl", "barbell_hip_thrust", "single_leg_glute_bridge", "single_leg_calf_raise", "crunch",
  "bicycle_crunch", "lying_leg_raise", "russian_twist", "wood_chop", "mountain_climber"];

const profile: Profile = {
  id: "client", displayName: "Client", experience: "beginner", sessionsPerWeek: 3, trainingDays: [1, 3, 5], trainingStartDate: "2026-01-01",
  timeZone: "Asia/Kolkata", deadliftEnabled: true, trainerRole: false, preferredSessionMinutes: 45, equipmentAvailability: "verified",
  availableEquipment: EQUIPMENT_OPTIONS.map((option) => option.id),
};

test("every saved exercise ID still exists, and IDs are unique and stable-looking", () => {
  for (const id of KNOWN_IDS) assert.ok(ids.has(id), `${id} was removed or renamed; saved plans and logs still use it`);
  assert.equal(ids.size, EXERCISE_LIBRARY.length, "duplicate exercise ID");
  for (const id of ids) assert.match(id, /^[a-z][a-z0-9_]*$/, `${id}: IDs are lower_snake_case`);
});

test("names are unique after normalising", () => {
  const seen = new Map<string, string>();
  for (const exercise of EXERCISE_LIBRARY) {
    const key = norm(exercise.name);
    assert.ok(!seen.has(key), `${exercise.id} has the same name as ${seen.get(key)}`);
    seen.set(key, exercise.id);
  }
});

test("aliases belong to real exercises, are unique, and never repeat a name", () => {
  const names = new Map(EXERCISE_LIBRARY.map((exercise) => [norm(exercise.name), exercise.id]));
  const owner = new Map<string, string>();
  for (const [id, aliases] of Object.entries(EXERCISE_ALIASES)) {
    assert.ok(ids.has(id), `aliases for unknown exercise ${id}`);
    for (const alias of aliases) {
      const key = norm(alias);
      assert.ok(key.length >= 2, `${id}: empty alias`);
      // "pull-up" and "pull up" may both sit on one exercise (search keeps hyphens); never on two exercises.
      assert.ok(!owner.has(key) || owner.get(key) === id, `alias "${alias}" is on both ${owner.get(key)} and ${id}`);
      assert.ok(!names.has(key), `alias "${alias}" on ${id} is the name of ${names.get(key)}`);
      owner.set(key, id);
    }
  }
  for (const exercise of EXERCISE_LIBRARY) assert.deepEqual(exercise.aliases, EXERCISE_ALIASES[exercise.id] ?? [], `${exercise.id} aliases are applied`);
});

test("every muscle text maps to a controlled value, and every exercise has a main muscle", () => {
  for (const exercise of EXERCISE_LIBRARY) {
    for (const text of exercise.targetMuscles) assert.ok(muscleKey(text), `${exercise.id}: add "${text}" to MUSCLE_TEXT in exercise-taxonomy.ts`);
    assert.ok(exercise.muscles && exercise.muscles.length > 0, `${exercise.id} needs a main muscle`);
    assert.equal(exercise.muscles[0], muscleKey(exercise.targetMuscles[0]), `${exercise.id}: main muscle comes first`);
    for (const muscle of exercise.muscles) assert.ok(muscle in TARGET_MUSCLE_LABELS);
  }
});

test("equipment keys, movement patterns and categories are valid and consistent", () => {
  const equipment = new Set(EQUIPMENT_OPTIONS.map((option) => option.id));
  for (const exercise of EXERCISE_LIBRARY) {
    for (const key of [...(exercise.requiredEquipment ?? []), ...(exercise.equipmentAlternatives ?? []).flat()]) assert.ok(equipment.has(key), `${exercise.id}: unknown equipment ${key}`);
    assert.ok(exercise.movementPattern && exercise.movementPattern in MOVEMENT_PATTERN_LABELS, `${exercise.id}: needs a movement pattern`);
    if (exercise.movementPattern === "cardio") assert.equal(exercise.category, "conditioning", `${exercise.id}: cardio is conditioning`);
    if (exercise.muscles?.[0] === "cardio") assert.equal(exercise.movementPattern, "cardio", `${exercise.id}: heart-and-lungs work uses the cardio pattern`);
    assert.ok(exercise.instructions.length >= 3 && exercise.cues.length >= 1, `${exercise.id}: needs steps and cues`);
  }
});

test("fallbacks exist, aren't the exercise itself, and never loop", () => {
  for (const exercise of EXERCISE_LIBRARY) {
    const seen = new Set([exercise.id]);
    let next = exercise.fallbackId;
    while (next) {
      assert.ok(ids.has(next), `${exercise.id}: fallback ${next} doesn't exist`);
      assert.ok(!seen.has(next), `${exercise.id}: fallback chain loops at ${next}`);
      seen.add(next);
      next = getExerciseDefinition(next)?.fallbackId;
    }
  }
});

test("variation groups list real exercises, each in one group, with 2+ members", () => {
  const member = new Map<string, string>();
  for (const [group, list] of Object.entries(VARIATION_GROUPS)) {
    assert.ok(list.length >= 2, `${group} needs at least two exercises`);
    for (const id of list) {
      assert.ok(ids.has(id), `${group}: unknown exercise ${id}`);
      assert.ok(!member.has(id), `${id} is in both ${member.get(id)} and ${group}`);
      member.set(id, group);
      assert.equal(getExerciseDefinition(id)?.variationGroup, group);
    }
  }
});

test("other names find the right exercise in search, swaps and Rozi", () => {
  assert.equal(exerciseSearchRank(getExerciseDefinition("barbell_ohp")!, "military press"), 0);
  assert.equal(exerciseSearchRank(getExerciseDefinition("pec_deck")!, "pec deck fly"), 0);
  assert.equal(findExercise("OHP")?.id, "barbell_ohp");
  assert.equal(findExercise("military press")?.id, "barbell_ohp");
  assert.equal(findExercise("pull ups")?.id, "pullup");
  assert.equal(findExercise("skull crushers")?.id, "skull_crusher");
  assert.equal(findExercise("rear delt fly")?.id, "reverse_db_fly");
  assert.equal(findExercise("dumbbell chest press")?.id, "dumbbell_bench");
  assert.equal(findExercise("lat pull down")?.id, "lat_pulldown");
  assert.equal(findExercise("chin ups")?.id, "chinup");
  assert.equal(findExercise("bent over row")?.id, "barbell_row");
  assert.equal(findExercise("farmers walk")?.id, "farmer_carry");
  assert.equal(exerciseSearchRank(getExerciseDefinition("comfortable_walk")!, "farmers walk"), null, "a one-word alias isn't matched inside a longer name");
  assert.equal(findNamedExercise("pec deck fly", profile)?.id, "pec_deck");
  assert.equal(findNamedExercise("dumbbell rdl", { ...profile, availableEquipment: ["dumbbells"] })?.id, "dumbbell_rdl");
  assert.equal(findExercise("walk")?.id, "comfortable_walk", "a name match beats part of another exercise's alias");
  assert.equal(findNamedExercise("walk", profile)?.id, "comfortable_walk");
  // Plain words name the standard exercise; in a swap, someone who can't do it gets the closest version they can.
  const dumbbellsOnly: Profile = { ...profile, availableEquipment: ["dumbbells", "bench"] };
  assert.equal(findExercise("bench")?.id, "barbell_bench");
  assert.equal(findNamedExercise("bench", profile)?.id, "barbell_bench");
  assert.equal(findNamedExercise("bench", dumbbellsOnly)?.id, "dumbbell_bench");
  assert.equal(findNamedExercise("squat", dumbbellsOnly)?.id, "goblet_squat");
  assert.equal(findNamedExercise("curl", dumbbellsOnly)?.id, "db_curl");
  assert.equal(findNamedExercise("leg curl", { ...profile, availableEquipment: [] })?.id, "slider_leg_curl");
  assert.equal(findNamedExercise("ohp", dumbbellsOnly)?.id, "shoulder_press");
  assert.equal(findNamedExercise("pull up", { ...profile, availableEquipment: [] })?.id, "pullup", "nothing usable: the named one, so the swap can say why");
});

test("the library's muscle filter uses controlled values", () => {
  const options = getExerciseLibraryFilterOptions(EXERCISE_LIBRARY, profile);
  const keys = options.muscleGroups.map((option) => option.key);
  assert.equal(new Set(keys).size, keys.length, "no duplicate muscle options");
  assert.ok(options.muscleGroups.some((option) => option.key === "shoulders" && option.label === "Shoulders"));
  const shoulders = filterExerciseLibrary(EXERCISE_LIBRARY, profile, { muscleGroup: "shoulders" }).map((exercise) => exercise.id);
  assert.ok(shoulders.includes("lateral_raise") && shoulders.includes("barbell_bench"), "side and front shoulders both count as shoulders");
  assert.ok(!shoulders.includes("leg_press"));
});

test("equipment alternatives: a kettlebell or band unlocks the exercises that accept it", () => {
  for (const [id, sets] of Object.entries(EQUIPMENT_ALTERNATIVES)) {
    assert.ok(ids.has(id), `alternatives for unknown exercise ${id}`);
    assert.ok(sets.every((set) => set.length > 0), `${id}: an alternative can't be empty`);
    assert.deepEqual(getExerciseDefinition(id)?.equipmentAlternatives, sets);
  }
  const only = (keys: Profile["availableEquipment"]): Profile => ({ ...profile, availableEquipment: keys });
  const goblet = getExerciseDefinition("goblet_squat")!;
  assert.ok(exerciseEquipmentIsAvailable(goblet, only(["kettlebell"])), "goblet squat with a kettlebell");
  assert.ok(exerciseEquipmentIsAvailable(goblet, only(["dumbbells"])), "still works with a dumbbell");
  assert.ok(!exerciseEquipmentIsAvailable(goblet, only(["resistance_band"])));
  assert.ok(exerciseEquipmentIsAvailable(getExerciseDefinition("pallof_press")!, only(["resistance_band"])), "Pallof press with a band");
  assert.ok(!exerciseEquipmentIsAvailable(getExerciseDefinition("lat_pulldown")!, only(["resistance_band", "kettlebell"])), "no alternative, no change");
  assert.ok(!exerciseEquipmentIsAvailable(goblet, { ...only(["kettlebell"]), equipmentAvailability: "unknown" }), "unconfirmed equipment still counts as none");
  const kettlebell = filterExerciseLibrary(EXERCISE_LIBRARY, profile, { equipment: "kettlebell" }).map((exercise) => exercise.id).sort();
  assert.deepEqual(kettlebell, ["farmer_carry", "goblet_squat"]);
  assert.ok(getExerciseLibraryFilterOptions(EXERCISE_LIBRARY, profile).equipment.some((option) => option.key === "resistance_band" && option.label === "Resistance bands"));
  assert.ok(GYM_OPTIONS.find((option) => option.id === "large_gym")?.equipment.includes("kettlebell"));
});

test("R6 batch A: 22 upper-body exercises, complete and safe", () => {
  assert.equal(BATCH_A_UPPER.length, 22);
  for (const item of BATCH_A_UPPER) {
    const exercise = getExerciseDefinition(item.id)!;
    assert.ok(exercise, `${item.id} is in the library`);
    assert.ok(exercise.instructions.length >= 3 && exercise.cues.length >= 3, `${item.id}: steps and cues`);
    assert.ok(exercise.cautionNotes.length >= 1, `${item.id}: a caution`);
    assert.ok(exercise.fallbackId && getExerciseDefinition(exercise.fallbackId), `${item.id}: a fallback that exists`);
    assert.ok(regionsForExercises([exercise]).length > 0, `${item.id}: shows on the body map`);
    assert.ok(exercise.variationGroup || ["db_shrug", "dead_hang", "bench_dips"].includes(item.id), `${item.id}: in a variation group`);
  }
  // The deadlift stays locked behind trainer approval, and trainers can't put it in a template.
  const deadlift = getExerciseDefinition("conventional_deadlift")!;
  assert.equal(deadlift.restriction, "trainer_deadlift_approval");
  assert.ok(!canUseExercise(deadlift, { ...profile, deadliftEnabled: false }));
  assert.ok(!isTrainerEditableTemplateExercise("conventional_deadlift"));
  // New exercises are never automatic planner fill-ins, so existing plans stay the same.
  for (const item of BATCH_A_UPPER) assert.ok(NOT_AUTO_PICKED.has(item.id));
  // The dead hang is timed.
  assert.equal(getExerciseDefinition("dead_hang")?.tracking?.unit, "seconds");
});

test("R6 batch A gives home and band users real options", () => {
  const home: Profile = { ...profile, availableEquipment: ["mat", "chair"] };
  const bands: Profile = { ...profile, availableEquipment: ["resistance_band"] };
  assert.ok(canUseExercise(getExerciseDefinition("knee_pushup")!, home));
  assert.ok(canUseExercise(getExerciseDefinition("pike_pushup")!, home));
  assert.ok(canUseExercise(getExerciseDefinition("bench_dips")!, home), "a chair works for bench dips");
  for (const id of ["band_row", "band_pull_apart", "band_curl", "pallof_press"]) assert.ok(canUseExercise(getExerciseDefinition(id)!, bands), `${id} with only a band`);
  // Swapping a dumbbell bench press at home now offers a no-equipment press.
  const bench = getExerciseDefinition("dumbbell_bench")!;
  const choices = swapChoices(bench, home, [bench]);
  assert.ok([...choices.suggested, ...choices.others].some((item) => item.id === "knee_pushup"));
});

test("R6 batch B: 12 lower-body and core exercises, complete and safe", () => {
  assert.equal(BATCH_B_LOWER_CORE.length, 12);
  for (const item of BATCH_B_LOWER_CORE) {
    const exercise = getExerciseDefinition(item.id)!;
    assert.ok(exercise.instructions.length >= 3 && exercise.cues.length >= 3 && exercise.cautionNotes.length >= 1, `${item.id}: steps, cues, a caution`);
    assert.ok(exercise.fallbackId && getExerciseDefinition(exercise.fallbackId), `${item.id}: a fallback that exists`);
    assert.ok(regionsForExercises([exercise]).length > 0, `${item.id}: shows on the body map`);
    assert.ok(exercise.variationGroup, `${item.id}: in a variation group`);
    assert.ok(NOT_AUTO_PICKED.has(item.id), `${item.id}: not an automatic planner fill-in`);
  }
  // "Single-leg Romanian deadlift" is a deadlift variation, so it follows the same trainer-approval rule as the RDLs.
  assert.equal(getExerciseDefinition("single_leg_rdl")?.restriction, "trainer_deadlift_approval");
  assert.ok(!canUseExercise(getExerciseDefinition("single_leg_rdl")!, { ...profile, deadliftEnabled: false }));
  // Holds and climbers are timed; the rest count reps.
  assert.equal(getExerciseDefinition("wall_sit")?.tracking?.unit, "seconds");
  assert.equal(getExerciseDefinition("mountain_climber")?.tracking?.unit, "seconds");
  assert.equal(getExerciseDefinition("crunch")?.tracking?.unit, "reps");
  // Home with no equipment now has a real core and single-leg menu.
  const bare: Profile = { ...profile, availableEquipment: [] };
  for (const id of ["walking_lunge", "wall_sit", "single_leg_glute_bridge", "single_leg_calf_raise", "crunch", "bicycle_crunch", "lying_leg_raise", "russian_twist", "mountain_climber"]) {
    assert.ok(canUseExercise(getExerciseDefinition(id)!, bare), `${id} with no equipment`);
  }
  assert.ok(canUseExercise(getExerciseDefinition("wood_chop")!, { ...profile, availableEquipment: ["resistance_band"] }), "wood chop with a band");
});
