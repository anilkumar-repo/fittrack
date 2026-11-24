import assert from "node:assert/strict";
import test from "node:test";
import {
  EXERCISE_LIBRARY,
  getExerciseDefinition,
} from "./templates.ts";
import {
  BODY_AREAS,
  equipmentSets,
  exerciseSearchRank,
  filterExerciseLibrary,
  getExerciseLibraryFilterOptions,
  getExerciseReferenceInstructions,
  getSafeExerciseAlternatives,
  isDeadliftVariation,
  NO_EQUIPMENT_FILTER,
  rankSearchResults,
} from "./exercise-library.ts";
import type { ExerciseDefinition, Profile } from "./types.ts";

const profile: Profile = {
  id: "client", displayName: "Client", experience: "beginner", sessionsPerWeek: 3,
  trainingDays: [2, 4, 6], trainingStartDate: "2026-01-01", timeZone: "Asia/Kolkata",
  deadliftEnabled: false, trainerRole: false, preferredSessionMinutes: 40,
  equipmentAvailability: "unknown", availableEquipment: [],
};

test("library exercises include beginner instructions and reference details", () => {
  assert.ok(EXERCISE_LIBRARY.length > 0);
  for (const exercise of EXERCISE_LIBRARY) {
    assert.ok(exercise.instructions.length >= 3, `${exercise.id} needs step-by-step guidance`);
    assert.ok(exercise.targetMuscles.length > 0, `${exercise.id} needs target muscles`);
    assert.ok(exercise.difficulty === "beginner" || exercise.difficulty === "intermediate");
    assert.ok(Number.isInteger(exercise.restSeconds) && exercise.restSeconds >= 0);
  }
});

test("search matches exercise names, target muscles, and instruction text without case sensitivity", () => {
  assert.ok(filterExerciseLibrary(EXERCISE_LIBRARY, profile, { query: "LAT PULLDOWN" }).some((item) => item.id === "lat_pulldown"));
  assert.ok(filterExerciseLibrary(EXERCISE_LIBRARY, profile, { query: "quadriceps" }).some((item) => item.id === "bodyweight_squat"));
  assert.ok(filterExerciseLibrary(EXERCISE_LIBRARY, profile, { query: "stable chair" }).some((item) => item.id === "sit_to_stand"));
});

test("muscle, movement, equipment, and difficulty filters can be combined", () => {
  const results = filterExerciseLibrary(EXERCISE_LIBRARY, profile, {
    muscleGroup: "chest",
    movementPattern: "horizontal_push",
    equipment: NO_EQUIPMENT_FILTER,
    difficulty: "beginner",
  });
  assert.ok(results.length > 0);
  assert.ok(results.every((item) => item.muscles?.includes("chest")));
  assert.ok(results.every((item) => item.movementPattern === "horizontal_push"));
  assert.ok(results.every((item) => item.requiredEquipment?.length === 0));
  assert.ok(results.every((item) => item.difficulty === "beginner"));
  // An exercise is listed when dumbbells are its equipment or an accepted alternative (skull crusher: EZ bar or dumbbells).
  assert.ok(filterExerciseLibrary(EXERCISE_LIBRARY, profile, { equipment: "dumbbells" }).every((item) => equipmentSets(item).some((set) => set.includes("dumbbells"))));
});

test("filter options follow exercises visible under the trainee's current restriction", () => {
  const options = getExerciseLibraryFilterOptions(EXERCISE_LIBRARY, profile);
  assert.ok(options.muscleGroups.some((item) => item.key === "glutes" && item.label === "Glutes"));
  assert.ok(options.movementPatterns.some((item) => item.key === "horizontal_pull"));
  assert.ok(options.equipment.some((item) => item.key === "dumbbells"));
  assert.ok(options.difficulties.includes("beginner"));
  assert.equal(filterExerciseLibrary(EXERCISE_LIBRARY, profile).some((item) => item.id === "dumbbell_rdl"), false);
});

test("text steps remain available when reference media is absent", () => {
  const squat = getExerciseDefinition("bodyweight_squat");
  assert.ok(squat);
  assert.ok(!("mediaUrl" in squat));
  assert.ok(getExerciseReferenceInstructions(squat).length >= 3);

  const olderEntry = { ...squat, instructions: [] } as ExerciseDefinition;
  assert.deepEqual(getExerciseReferenceInstructions(olderEntry), squat.cues);
  assert.ok(getExerciseReferenceInstructions({ ...squat, instructions: [], cues: [] })[0].includes("comfortable setup"));
});

test("alternatives respect verified equipment and avoid repeating a session movement", () => {
  const benchPress = getExerciseDefinition("dumbbell_bench");
  assert.ok(benchPress);
  const unknownAlternatives = getSafeExerciseAlternatives(benchPress, profile);
  assert.ok(unknownAlternatives.some((item) => item.id === "wall_pushup"));
  assert.ok(unknownAlternatives.every((item) => item.requiredEquipment?.length === 0));

  const equippedProfile = { ...profile, equipmentAvailability: "verified" as const, availableEquipment: ["bench", "dumbbells"] as Profile["availableEquipment"] };
  const equippedAlternatives = getSafeExerciseAlternatives(benchPress, equippedProfile);
  assert.ok(equippedAlternatives.some((item) => item.id === "incline_pushup"));

  const wallPushup = getExerciseDefinition("wall_pushup");
  assert.ok(wallPushup);
  assert.deepEqual(getSafeExerciseAlternatives(benchPress, profile, [wallPushup]), []);
});

test("deadlift variations stay out of search and alternatives until the restriction flag is enabled", () => {
  const restrictedNames = [
    { id: "barbell_deadlift", name: "Barbell deadlift" },
    { id: "romanian_deadlift", name: "Romanian deadlift" },
    { id: "single_leg_rdl", name: "Single-leg RDL" },
    { id: "stiff_leg_deadlift", name: "Stiff-leg deadlift" },
  ];
  assert.ok(restrictedNames.every((item) => isDeadliftVariation(item)));

  const locked = filterExerciseLibrary(EXERCISE_LIBRARY, profile, { query: "Romanian" });
  assert.equal(locked.some((item) => item.id === "dumbbell_rdl"), false);
  const bridge = getExerciseDefinition("glute_bridge");
  assert.ok(bridge);
  assert.ok(getSafeExerciseAlternatives(bridge, profile).every((item) => item.id !== "dumbbell_rdl"));

  const trainerApproved = { ...profile, deadliftEnabled: true, equipmentAvailability: "verified" as const, availableEquipment: ["dumbbells", "bench"] as Profile["availableEquipment"] };
  assert.ok(filterExerciseLibrary(EXERCISE_LIBRARY, trainerApproved, { query: "Romanian" }).some((item) => item.id === "dumbbell_rdl"));
});

test("body-area cards split the library into upper, lower and core without overlap", () => {
  const all = filterExerciseLibrary(EXERCISE_LIBRARY, profile, {});
  const counts = Object.fromEntries(BODY_AREAS.map((area) => [area.id, filterExerciseLibrary(EXERCISE_LIBRARY, profile, { area: area.id }).length]));
  assert.equal(counts.full, all.length);
  assert.equal(counts.upper + counts.lower + counts.core, all.length);
  assert.ok(filterExerciseLibrary(EXERCISE_LIBRARY, profile, { area: "lower" }).some((item) => item.id === "bodyweight_squat"));
  assert.ok(filterExerciseLibrary(EXERCISE_LIBRARY, profile, { area: "upper" }).every((item) => !["squat", "core"].includes(item.movementPattern ?? "")));
});

// The exercise picker's search (reported: "Biceps" listed pull-ups and rows first, A–Z).
const allowAll: Profile = { ...profile, experience: "advanced", deadliftEnabled: true, equipmentAvailability: "verified", availableEquipment: [] };

test("search ranks the name first, then the main muscle, then other muscles it works", () => {
  const curl = EXERCISE_LIBRARY.find((exercise) => exercise.name === "Dumbbell biceps curl")!;
  const row = EXERCISE_LIBRARY.find((exercise) => exercise.name === "Barbell row")!;
  assert.equal(exerciseSearchRank(curl, "biceps"), 0);
  assert.equal(exerciseSearchRank(row, "biceps"), 2);
  const ranked = rankSearchResults(filterExerciseLibrary(EXERCISE_LIBRARY, allowAll, { query: "Biceps" }), "Biceps");
  const firstOther = ranked.findIndex((item) => !item.best);
  assert.ok(firstOther > 0, "best matches come first");
  // Every best match trains biceps as its main muscle or has it in the name; rows come after them.
  for (const item of ranked.slice(0, firstOther)) assert.ok(/biceps/i.test(item.exercise.name) || item.exercise.targetMuscles[0] === "Biceps", item.exercise.name);
  assert.ok(ranked.slice(firstOther).some((item) => item.exercise.name === "Barbell row"));
  assert.ok(ranked.every((item) => item.exercise.targetMuscles.includes("Biceps") || /biceps/i.test(item.exercise.name)), "no moves that only mention biceps in their tips");
});

test("search understands short names and needs every word of a longer search", () => {
  assert.ok(filterExerciseLibrary(EXERCISE_LIBRARY, allowAll, { query: "quads" }).some((exercise) => exercise.targetMuscles.includes("Quadriceps")));
  assert.ok(filterExerciseLibrary(EXERCISE_LIBRARY, allowAll, { query: "abs" }).length > 0);
  const dumbbellCurls = filterExerciseLibrary(EXERCISE_LIBRARY, allowAll, { query: "dumbbell curl" });
  assert.ok(dumbbellCurls.length > 0 && dumbbellCurls.every((exercise) => /curl/i.test(exercise.name)));
  assert.equal(filterExerciseLibrary(EXERCISE_LIBRARY, allowAll, { query: "zzzz" }).length, 0);
  // A movement-type search still works when no name or muscle matches.
  assert.ok(filterExerciseLibrary(EXERCISE_LIBRARY, allowAll, { query: "hinge" }).length > 0);
  // "ham" still finds the hammer curl.
  assert.ok(filterExerciseLibrary(EXERCISE_LIBRARY, allowAll, { query: "ham" }).some((exercise) => /hammer/i.test(exercise.name)));
});
