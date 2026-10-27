import assert from "node:assert/strict";
import test from "node:test";
import {
  EXERCISE_LIBRARY,
  getExerciseDefinition,
} from "./templates.ts";
import {
  filterExerciseLibrary,
  getExerciseLibraryFilterOptions,
  getExerciseReferenceInstructions,
  getSafeExerciseAlternatives,
  isDeadliftVariation,
  NO_EQUIPMENT_FILTER,
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
    muscleGroup: "Chest",
    movementPattern: "horizontal_push",
    equipment: NO_EQUIPMENT_FILTER,
    difficulty: "beginner",
  });
  assert.ok(results.length > 0);
  assert.ok(results.every((item) => item.targetMuscles.includes("Chest")));
  assert.ok(results.every((item) => item.movementPattern === "horizontal_push"));
  assert.ok(results.every((item) => item.requiredEquipment?.length === 0));
  assert.ok(results.every((item) => item.difficulty === "beginner"));
  assert.ok(filterExerciseLibrary(EXERCISE_LIBRARY, profile, { equipment: "dumbbells" }).every((item) => item.requiredEquipment?.includes("dumbbells")));
});

test("filter options follow exercises visible under the trainee's current restriction", () => {
  const options = getExerciseLibraryFilterOptions(EXERCISE_LIBRARY, profile);
  assert.ok(options.muscleGroups.includes("Glutes"));
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
