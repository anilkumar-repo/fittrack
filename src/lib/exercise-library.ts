import { EQUIPMENT_OPTIONS, EXERCISE_LIBRARY, getExerciseDefinition } from "./templates.ts";
import type { EquipmentKey, ExerciseDefinition, ExerciseDifficulty, MovementPattern, Profile, WorkoutPlan } from "./types.ts";

export const MOVEMENT_PATTERN_LABELS: Record<MovementPattern, string> = {
  squat: "Squat",
  single_leg: "Single leg",
  horizontal_push: "Horizontal push",
  vertical_push: "Vertical push",
  horizontal_pull: "Horizontal pull",
  vertical_pull: "Vertical pull",
  hip_extension: "Hip extension",
  hamstring_curl: "Hamstring curl",
  core: "Core",
  carry: "Carry / conditioning",
  recovery: "Recovery",
};

export const NO_EQUIPMENT_FILTER = "no_equipment";

export interface ExerciseLibraryFilters {
  query?: string;
  category?: string;
  muscleGroup?: string;
  movementPattern?: string;
  equipment?: string;
  difficulty?: string;
}

export interface ExerciseLibraryFilterOptions {
  muscleGroups: string[];
  movementPatterns: Array<{ key: MovementPattern; label: string }>;
  equipment: Array<{ key: EquipmentKey | typeof NO_EQUIPMENT_FILTER; label: string }>;
  difficulties: ExerciseDifficulty[];
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().trim();
}

export function isDeadliftVariation(exercise: Pick<ExerciseDefinition, "id" | "name" | "restriction">): boolean {
  if (exercise.restriction === "trainer_deadlift_approval") return true;
  const normalized = `${exercise.id} ${exercise.name}`.replaceAll("_", " ").replaceAll("-", " ");
  return /\bdeadlift\b|\brdl\b|stiff\s*leg(?:ged)?/i.test(normalized);
}

export function isExerciseAllowedForProfile(exercise: ExerciseDefinition, profile: Profile): boolean {
  return !isDeadliftVariation(exercise) || profile.deadliftEnabled === true;
}

export function exerciseEquipmentIsAvailable(exercise: ExerciseDefinition, profile: Profile): boolean {
  const required = exercise.requiredEquipment ?? [];
  if (!required.length) return true;
  return profile.equipmentAvailability === "verified" && required.every((item) => profile.availableEquipment.includes(item));
}

export function workoutPlanMatchesProfile(plan: WorkoutPlan, profile: Profile): boolean {
  return plan.exercises.every((exercise) => isExerciseAllowedForProfile(exercise, profile) && exerciseEquipmentIsAvailable(exercise, profile));
}

export function getExerciseLibraryFilterOptions(
  exercises: ExerciseDefinition[] = EXERCISE_LIBRARY,
  profile: Profile,
): ExerciseLibraryFilterOptions {
  const allowed = exercises.filter((exercise) => isExerciseAllowedForProfile(exercise, profile));
  const muscles = new Set<string>();
  const patterns = new Set<MovementPattern>();
  const equipment = new Set<EquipmentKey>();
  const difficulties = new Set<ExerciseDifficulty>();
  let hasNoExternalEquipment = false;

  for (const exercise of allowed) {
    exercise.targetMuscles.forEach((muscle) => muscles.add(muscle));
    if (exercise.movementPattern) patterns.add(exercise.movementPattern);
    if (exercise.difficulty) difficulties.add(exercise.difficulty);
    const required = exercise.requiredEquipment ?? [];
    if (required.length) required.forEach((item) => equipment.add(item));
    else hasNoExternalEquipment = true;
  }

  const labels = new Map(EQUIPMENT_OPTIONS.map((option) => [option.id, option.label]));
  return {
    muscleGroups: [...muscles].sort((a, b) => a.localeCompare(b)),
    movementPatterns: [...patterns].sort((a, b) => MOVEMENT_PATTERN_LABELS[a].localeCompare(MOVEMENT_PATTERN_LABELS[b])).map((key) => ({ key, label: MOVEMENT_PATTERN_LABELS[key] })),
    equipment: [
      ...(hasNoExternalEquipment ? [{ key: NO_EQUIPMENT_FILTER as typeof NO_EQUIPMENT_FILTER, label: "No external equipment" }] : []),
      ...[...equipment].sort((a, b) => (labels.get(a) ?? a).localeCompare(labels.get(b) ?? b)).map((key) => ({ key, label: labels.get(key) ?? key })),
    ],
    difficulties: [...difficulties].sort(),
  };
}

export function filterExerciseLibrary(
  exercises: ExerciseDefinition[],
  profile: Profile,
  filters: ExerciseLibraryFilters = {},
): ExerciseDefinition[] {
  const query = normalize(filters.query ?? "");
  const muscleGroup = normalize(filters.muscleGroup ?? "");
  const pattern = filters.movementPattern ?? "";
  const equipment = filters.equipment ?? "";
  const difficulty = filters.difficulty ?? "";
  const category = normalize(filters.category ?? "all");

  return exercises.filter((exercise) => {
    if (!isExerciseAllowedForProfile(exercise, profile)) return false;
    if (category && category !== "all" && normalize(exercise.category) !== category) return false;
    if (muscleGroup && !exercise.targetMuscles.some((muscle) => normalize(muscle) === muscleGroup)) return false;
    if (pattern && exercise.movementPattern !== pattern) return false;
    if (equipment === NO_EQUIPMENT_FILTER && (exercise.requiredEquipment ?? []).length > 0) return false;
    if (equipment && equipment !== NO_EQUIPMENT_FILTER && !(exercise.requiredEquipment ?? []).includes(equipment as EquipmentKey)) return false;
    if (difficulty && exercise.difficulty !== difficulty) return false;
    if (!query) return true;
    const searchable = normalize([
      exercise.name,
      exercise.equipment,
      exercise.category,
      exercise.movementPattern ? MOVEMENT_PATTERN_LABELS[exercise.movementPattern] : "",
      ...exercise.targetMuscles,
      ...exercise.instructions,
      ...exercise.cues,
      ...exercise.cautionNotes,
    ].join(" "));
    return searchable.includes(query);
  });
}

export function getSafeExerciseAlternatives(
  exercise: ExerciseDefinition,
  profile: Profile,
  otherSessionExercises: ExerciseDefinition[] = [],
): ExerciseDefinition[] {
  const source = getExerciseDefinition(exercise.id) ?? exercise;
  if (!isExerciseAllowedForProfile(source, profile) || !source.movementPattern) return [];

  const occupiedIds = new Set(otherSessionExercises.map((item) => item.id));
  const occupiedPatterns = new Set(otherSessionExercises.map((item) => item.movementPattern).filter((item): item is MovementPattern => Boolean(item)));
  const fallback = source.fallbackId ? getExerciseDefinition(source.fallbackId) : undefined;
  const candidates = [
    ...(fallback ? [fallback] : []),
    ...EXERCISE_LIBRARY.filter((candidate) => candidate.id !== source.id && candidate.id !== fallback?.id)
      .sort((a, b) => a.name.localeCompare(b.name)),
  ];
  const seen = new Set<string>();

  return candidates.filter((candidate) => {
    const candidatePattern = candidate.movementPattern;
    if (seen.has(candidate.id) || candidate.id === source.id || !candidatePattern || candidatePattern !== source.movementPattern) return false;
    seen.add(candidate.id);
    if (occupiedIds.has(candidate.id) || occupiedPatterns.has(candidatePattern)) return false;
    return isExerciseAllowedForProfile(candidate, profile) && exerciseEquipmentIsAvailable(candidate, profile);
  }).slice(0, 4).map((candidate) => ({
    ...candidate,
    selectionReason: `Same-pattern alternative to ${source.name}; uses ${candidate.equipment.toLocaleLowerCase()} and respects the current exercise restrictions.`,
  }));
}

export function getExerciseReferenceInstructions(exercise: ExerciseDefinition): string[] {
  const instructions = exercise.instructions?.filter((step) => typeof step === "string" && step.trim().length > 0) ?? [];
  if (instructions.length) return instructions;
  const cues = exercise.cues?.filter((step) => typeof step === "string" && step.trim().length > 0) ?? [];
  if (cues.length) return cues;
  return ["Use a comfortable setup and ask your trainer to demonstrate the movement before you begin."];
}
