import { EQUIPMENT_OPTIONS, EXERCISE_LIBRARY, getExerciseDefinition } from "./templates.ts";
import { musclesFor, TARGET_MUSCLE_LABELS } from "./exercise-taxonomy.ts";
import type { EquipmentKey, ExerciseDefinition, ExerciseDifficulty, MovementPattern, Profile, TargetMuscle, WorkoutPlan } from "./types.ts";

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
  shoulder_raise: "Shoulder raise",
  chest_fly: "Chest fly",
  arm_curl: "Curl (biceps / forearms)",
  arm_extension: "Triceps extension",
  knee_extension: "Leg extension",
  calf_raise: "Calf raise",
  cardio: "Cardio",
};

export const NO_EQUIPMENT_FILTER = "no_equipment";

export interface ExerciseLibraryFilters {
  query?: string;
  category?: string;
  /** A TargetMuscle value (e.g. "chest"); matches any muscle the exercise works. */
  muscleGroup?: string;
  movementPattern?: string;
  equipment?: string;
  difficulty?: string;
  /** A body area from BODY_AREAS; "full" or empty shows everything. */
  area?: string;
}

export type BodyArea = "full" | "upper" | "lower" | "core";

/** The library's body-area cards, each a set of movement patterns. */
export const BODY_AREAS: Array<{ id: BodyArea; label: string; patterns: MovementPattern[] | null }> = [
  { id: "full", label: "Full body", patterns: null },
  { id: "upper", label: "Upper body", patterns: ["horizontal_push", "vertical_push", "horizontal_pull", "vertical_pull", "shoulder_raise", "chest_fly", "arm_curl", "arm_extension"] },
  { id: "lower", label: "Lower body", patterns: ["squat", "single_leg", "hip_extension", "hamstring_curl", "knee_extension", "calf_raise"] },
  { id: "core", label: "Core & cardio", patterns: ["core", "carry", "recovery", "cardio"] },
];

export function exerciseInArea(exercise: Pick<ExerciseDefinition, "movementPattern">, area: string): boolean {
  const patterns = BODY_AREAS.find((item) => item.id === area)?.patterns;
  if (!patterns) return true;
  return Boolean(exercise.movementPattern && patterns.includes(exercise.movementPattern));
}

export interface ExerciseLibraryFilterOptions {
  muscleGroups: Array<{ key: TargetMuscle; label: string }>;
  movementPatterns: Array<{ key: MovementPattern; label: string }>;
  equipment: Array<{ key: EquipmentKey | typeof NO_EQUIPMENT_FILTER; label: string }>;
  difficulties: ExerciseDifficulty[];
}

/** An exercise's controlled muscles (old saved copies without them are worked out from the muscle text). */
export function exerciseMuscles(exercise: Pick<ExerciseDefinition, "muscles" | "targetMuscles">): TargetMuscle[] {
  return exercise.muscles?.length ? exercise.muscles : musclesFor(exercise.targetMuscles ?? []);
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

/** Every equipment set that lets someone do the exercise: the required one, then any alternatives. */
export function equipmentSets(exercise: Pick<ExerciseDefinition, "requiredEquipment" | "equipmentAlternatives">): EquipmentKey[][] {
  return [exercise.requiredEquipment ?? [], ...(exercise.equipmentAlternatives ?? [])];
}

/** Whether the listed equipment covers the exercise (its required equipment, or one of its alternatives). */
export function hasEquipmentFor(exercise: Pick<ExerciseDefinition, "requiredEquipment" | "equipmentAlternatives">, available: EquipmentKey[]): boolean {
  return equipmentSets(exercise).some((set) => set.every((item) => available.includes(item)));
}

export function exerciseEquipmentIsAvailable(exercise: ExerciseDefinition, profile: Profile): boolean {
  if (!(exercise.requiredEquipment ?? []).length) return true;
  return profile.equipmentAvailability === "verified" && hasEquipmentFor(exercise, profile.availableEquipment);
}

export function workoutPlanMatchesProfile(plan: WorkoutPlan, profile: Profile): boolean {
  // A plan made for a different goal (plans without a goal belong to "general") is planned again.
  const planGoal = plan.goal ?? "general";
  const profileGoal = profile.goal === "muscle" || profile.goal === "tone" || profile.goal === "fatloss" ? profile.goal : "general";
  if (planGoal !== profileGoal) return false;
  return plan.exercises.every((exercise) => isExerciseAllowedForProfile(exercise, profile) && exerciseEquipmentIsAvailable(exercise, profile));
}

export function getExerciseLibraryFilterOptions(
  exercises: ExerciseDefinition[] = EXERCISE_LIBRARY,
  profile: Profile,
): ExerciseLibraryFilterOptions {
  const allowed = exercises.filter((exercise) => isExerciseAllowedForProfile(exercise, profile));
  const muscles = new Set<TargetMuscle>();
  const patterns = new Set<MovementPattern>();
  const equipment = new Set<EquipmentKey>();
  const difficulties = new Set<ExerciseDifficulty>();
  let hasNoExternalEquipment = false;

  for (const exercise of allowed) {
    exerciseMuscles(exercise).forEach((muscle) => muscles.add(muscle));
    if (exercise.movementPattern) patterns.add(exercise.movementPattern);
    if (exercise.difficulty) difficulties.add(exercise.difficulty);
    const required = exercise.requiredEquipment ?? [];
    if (required.length) equipmentSets(exercise).flat().forEach((item) => equipment.add(item));
    else hasNoExternalEquipment = true;
  }

  const labels = new Map(EQUIPMENT_OPTIONS.map((option) => [option.id, option.label]));
  return {
    muscleGroups: [...muscles].map((key) => ({ key, label: TARGET_MUSCLE_LABELS[key] })).sort((a, b) => a.label.localeCompare(b.label)),
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
  const muscleGroup = filters.muscleGroup ?? "";
  const pattern = filters.movementPattern ?? "";
  const equipment = filters.equipment ?? "";
  const difficulty = filters.difficulty ?? "";
  const category = normalize(filters.category ?? "all");
  // Only the best level of match shows: name / muscles / equipment first; if none, the movement type; if none,
  // the how-to text. So "biceps" lists curls and rows, not wrist curls (an arm-curl movement) or moves whose tips
  // happen to mention biceps. Decided across the whole library, so every category tab follows the same rule.
  const ranks = query ? new Map(exercises.map((exercise) => [exercise.id, exerciseSearchRank(exercise, query)])) : null;
  const tier = (rank: number) => (rank <= 2 ? 0 : rank === 3 ? 1 : 2);
  const bestTier = ranks ? Math.min(3, ...exercises.filter((exercise) => isExerciseAllowedForProfile(exercise, profile))
    .map((exercise) => ranks.get(exercise.id)).filter((rank): rank is number => rank !== null && rank !== undefined).map(tier)) : 0;

  return exercises.filter((exercise) => {
    if (!isExerciseAllowedForProfile(exercise, profile)) return false;
    if (category && category !== "all" && normalize(exercise.category) !== category) return false;
    if (muscleGroup && !exerciseMuscles(exercise).includes(muscleGroup as TargetMuscle)) return false;
    if (pattern && exercise.movementPattern !== pattern) return false;
    if (equipment === NO_EQUIPMENT_FILTER && (exercise.requiredEquipment ?? []).length > 0) return false;
    if (equipment && equipment !== NO_EQUIPMENT_FILTER && !equipmentSets(exercise).some((set) => set.includes(equipment as EquipmentKey))) return false;
    if (difficulty && exercise.difficulty !== difficulty) return false;
    if (filters.area && !exerciseInArea(exercise, filters.area)) return false;
    if (!ranks) return true;
    const rank = ranks.get(exercise.id) ?? null;
    return rank !== null && tier(rank) === bestTier;
  });
}

// ---------- Search ----------

/** Everyday short names people type for muscles. */
const SEARCH_ALIASES: Record<string, string[]> = {
  abs: ["abs", "core", "abdominals", "obliques"], core: ["core", "abs", "abdominals", "obliques"],
  quads: ["quadriceps"], hams: ["hamstrings"], delts: ["shoulders"], pecs: ["chest"], bis: ["biceps"], tris: ["triceps"], butt: ["glutes"],
  back: ["back", "lats"], legs: ["legs", "quadriceps", "hamstrings", "glutes", "calves"], arms: ["biceps", "triceps", "forearms"],
};

/**
 * How well an exercise matches a search, best first: 0 the name or a whole other name it goes by ("OHP", "military
 * press"), 1 its main muscle or part of another name ("walk" in "farmers walk"), 2 another muscle it works,
 * its equipment or category, 3 its movement type, 4 only its how-to text. null = no match. Every word of a longer
 * search must match.
 */
export function exerciseSearchRank(exercise: ExerciseDefinition, rawQuery: string): number | null {
  const query = normalize(rawQuery);
  if (!query) return 0;
  const words = query.split(/\s+/).filter(Boolean);
  const termsFor = (word: string) => SEARCH_ALIASES[word] ?? [word];
  const has = (text: string, word: string) => termsFor(word).some((term) => text.includes(term));
  const all = (text: string) => words.every((word) => has(text, word));
  const name = normalize(exercise.name);
  if (name.includes(query) || all(name)) return 0;
  const aliases = (exercise.aliases ?? []).map(normalize);
  // A whole other name, or a longer one inside the search ("military press form"); a one-word name ("walk") must be the
  // whole search, so "farmers walk" doesn't also find the comfortable walk.
  if (aliases.some((alias) => alias === query || (alias.includes(" ") && ` ${query} `.includes(` ${alias} `)))) return 0;
  const muscles = exercise.targetMuscles.map(normalize);
  if (muscles[0] && all(muscles[0])) return 1;
  if (aliases.some((alias) => alias.includes(query) || all(alias))) return 1;
  const strong = normalize([exercise.name, exercise.equipment, exercise.category, ...exercise.targetMuscles].join(" "));
  if (all(strong)) return 2;
  const withPattern = normalize([strong, exercise.movementPattern ? MOVEMENT_PATTERN_LABELS[exercise.movementPattern] : ""].join(" "));
  if (all(withPattern)) return 3;
  const text = normalize([withPattern, ...exercise.instructions, ...exercise.cues, ...exercise.cautionNotes].join(" "));
  return all(text) ? 4 : null;
}

/** The exercise whose name, or one of whose other names, is exactly what was typed ("walk", "OHP"), if any. */
export function exactExerciseMatch(exercises: ExerciseDefinition[], rawQuery: string): ExerciseDefinition | undefined {
  const query = normalize(rawQuery);
  if (!query) return undefined;
  return exercises.find((exercise) => normalize(exercise.name) === query) ?? exercises.find((exercise) => (exercise.aliases ?? []).some((alias) => normalize(alias) === query));
}

/** Search results in order: best matches (name or main muscle) first, then the rest; A–Z within each. */
export function rankSearchResults(exercises: ExerciseDefinition[], query: string): Array<{ exercise: ExerciseDefinition; best: boolean }> {
  return exercises
    .map((exercise) => ({ exercise, rank: exerciseSearchRank(exercise, query) ?? 5 }))
    .sort((a, b) => a.rank - b.rank || a.exercise.name.localeCompare(b.exercise.name))
    .map(({ exercise, rank }) => ({ exercise, best: rank <= 1 }));
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
    // Versions of the same movement first (R7), then the rest A–Z.
    ...EXERCISE_LIBRARY.filter((candidate) => candidate.id !== source.id && candidate.id !== fallback?.id)
      .sort((a, b) => Number(b.variationGroup === source.variationGroup && Boolean(source.variationGroup)) - Number(a.variationGroup === source.variationGroup && Boolean(source.variationGroup)) || a.name.localeCompare(b.name)),
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
