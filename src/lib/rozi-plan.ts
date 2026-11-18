import { exerciseEquipmentIsAvailable, isExerciseAllowedForProfile } from "./exercise-library.ts";
import { levelOf, levelTitle } from "./levels.ts";
import type { Routine } from "./pro-tracking";
import { EXERCISE_LIBRARY } from "./templates.ts";
import type { ExerciseDefinition, ExperienceLevel, MovementPattern, Profile } from "./types";

// ---------- Ask Rozi: "plan me a leg workout" ----------

export type PlanTarget = "legs" | "glutes" | "chest" | "back" | "shoulders" | "arms" | "push" | "pull" | "upper" | "lower" | "full" | "core";

const TARGET_LABEL: Record<PlanTarget, string> = {
  legs: "Leg day", glutes: "Glutes", chest: "Chest day", back: "Back day", shoulders: "Shoulder day", arms: "Arm day",
  push: "Push day", pull: "Pull day", upper: "Upper body", lower: "Lower body", full: "Full body", core: "Core",
};

// The first matching word wins, so more specific ones come first ("lower body" before "body", "glute" before "leg").
const TARGET_WORDS: Array<[PlanTarget, RegExp]> = [
  ["upper", /\bupper(\s*body)?\b/], ["lower", /\blower(\s*body)?\b/], ["full", /\bfull(\s*body)?\b|\bwhole body\b|\btotal body\b/],
  ["glutes", /\bglutes?\b|\bbum\b|\bbutt\b|\bhips?\b/], ["legs", /\blegs?\b|\bquads?\b|\bhamstrings?\b|\bcalf\b|\bcalves\b|\bsquats?\b/],
  ["push", /\bpush\b/], ["pull", /\bpull\b/], ["chest", /\bchest\b|\bpecs?\b/], ["back", /\bback\b|\blats?\b/],
  ["shoulders", /\bshoulders?\b|\bdelts?\b/], ["arms", /\barms?\b|\bbiceps?\b|\btriceps?\b|\bbis\b|\btris\b/], ["core", /\bcore\b|\babs\b|\babdominals?\b|\bsix ?pack\b/],
];

/** What body area a request is about ("plan me a leg workout" → legs; nothing specific → full body). */
export function planTarget(message: string): PlanTarget {
  const text = message.toLowerCase();
  return TARGET_WORDS.find(([, pattern]) => pattern.test(text))?.[0] ?? "full";
}

/** Minutes asked for ("30 min", "45 minutes", "an hour"), or null. Kept between 15 and 90. */
export function planMinutes(message: string): number | null {
  const text = message.toLowerCase();
  if (/\b(an|one|1)\s*(hour|hr)\b/.test(text)) return 60;
  const match = text.match(/\b(\d{2,3})\s*(?:-|\s)?(?:min|mins|minute|minutes|m)\b/);
  if (!match) return null;
  return Math.min(90, Math.max(15, Number(match[1])));
}

// Movement slots for each target, in order: big lifts first, smaller ones after.
const SLOTS: Record<PlanTarget, MovementPattern[]> = {
  legs: ["squat", "hip_extension", "single_leg", "hamstring_curl", "knee_extension", "calf_raise", "squat", "single_leg"],
  lower: ["squat", "hip_extension", "single_leg", "hamstring_curl", "calf_raise", "core", "knee_extension"],
  glutes: ["hip_extension", "single_leg", "squat", "hip_extension", "hamstring_curl", "single_leg"],
  chest: ["horizontal_push", "horizontal_push", "chest_fly", "arm_extension", "horizontal_push", "chest_fly"],
  back: ["vertical_pull", "horizontal_pull", "horizontal_pull", "vertical_pull", "arm_curl", "horizontal_pull"],
  shoulders: ["vertical_push", "shoulder_raise", "horizontal_pull", "vertical_push", "shoulder_raise", "arm_extension"],
  arms: ["arm_curl", "arm_extension", "arm_curl", "arm_extension", "arm_curl", "arm_extension"],
  push: ["horizontal_push", "vertical_push", "chest_fly", "shoulder_raise", "arm_extension", "horizontal_push"],
  pull: ["vertical_pull", "horizontal_pull", "arm_curl", "horizontal_pull", "arm_curl", "vertical_pull"],
  upper: ["horizontal_push", "horizontal_pull", "vertical_push", "vertical_pull", "arm_curl", "arm_extension", "shoulder_raise"],
  full: ["squat", "horizontal_push", "horizontal_pull", "hip_extension", "vertical_push", "single_leg", "core"],
  core: ["core", "core", "core", "core", "core", "core"],
};

const SETS: Record<ExperienceLevel, [main: number, rest: number]> = { beginner: [2, 2], intermediate: [3, 3], advanced: [4, 3], pro: [4, 4] };

/** Moves that are warm-ups or recovery, not training (never picked for a plan). */
const NOT_TRAINING = /breathing|walk|march|wall slide/i;

function goalReps(goal: Profile["goal"], level: ExperienceLevel): string {
  if (goal === "muscle") return level === "beginner" ? "10–12" : "8–12";
  if (goal === "fatloss") return "12–15";
  if (goal === "tone") return "10–15";
  return "10–12";
}

/** How well a move suits the level: beginners get simple moves; experienced people get loaded, harder ones first. */
function fitScore(exercise: ExerciseDefinition, level: ExperienceLevel): number {
  const loaded = (exercise.requiredEquipment ?? []).length > 0 ? 1 : 0;
  const harder = exercise.difficulty === "intermediate" ? 1 : 0;
  return level === "beginner" ? (harder ? -2 : 0) + loaded : harder * 2 + loaded;
}

export interface RoziPlan {
  target: PlanTarget;
  routine: Routine;
  minutes: number;
  level: ExperienceLevel;
  /** One line about why it looks like this ("Pro level: 4 sets on the big lifts. Only equipment you have."). */
  note: string;
}

/**
 * A workout Rozi plans on request: the moves for the asked area that are allowed for you (deadlifts only with your
 * trainer's OK) and use only equipment you've confirmed (bodyweight if you haven't), harder moves for higher levels,
 * sets by level and reps by goal. About one move per 8 minutes (3–7 moves). Null when nothing fits.
 */
export function planWorkout(message: string, profile: Profile, library: ExerciseDefinition[] = EXERCISE_LIBRARY): RoziPlan | null {
  const target = planTarget(message);
  const minutes = planMinutes(message) ?? profile.preferredSessionMinutes ?? 45;
  const level = levelOf(profile);
  const usable = library.filter((exercise) => exercise.movementPattern && isExerciseAllowedForProfile(exercise, profile)
    && exerciseEquipmentIsAvailable(exercise, profile) && !NOT_TRAINING.test(exercise.name));
  const count = Math.min(7, Math.max(3, Math.round(minutes / 8)));
  const picked: ExerciseDefinition[] = [];
  const slots = SLOTS[target];
  for (let round = 0; picked.length < count && round < 3; round++) {
    for (const pattern of slots) {
      if (picked.length >= count) break;
      const choice = usable.filter((exercise) => exercise.movementPattern === pattern && !picked.includes(exercise))
        .sort((a, b) => fitScore(b, level) - fitScore(a, level))[0];
      if (choice) picked.push(choice);
    }
  }
  if (!picked.length) return null;
  const [mainSets, otherSets] = SETS[level];
  const reps = goalReps(profile.goal, level);
  const plain = /^\d{1,2}(–\d{1,2})?$/;
  const routine: Routine = {
    id: `rozi-${target}`,
    name: `${TARGET_LABEL[target]} · by Rozi`,
    exercises: picked.map((exercise, index) => ({
      exerciseId: exercise.id,
      sets: exercise.category === "core" || exercise.category === "conditioning" ? Math.min(3, otherSets) : index < 2 ? mainSets : otherSets,
      // Timed or one-side moves keep their own wording ("20–30 sec", "8 each side").
      reps: plain.test(exercise.reps) ? reps : exercise.reps,
    })),
    updatedAt: "",
  };
  const equipmentNote = profile.equipmentAvailability === "verified" ? "Only equipment you have." : "Bodyweight moves, since your equipment isn’t set yet.";
  const note = `${levelTitle(level)} level: ${mainSets} sets on the big moves, ${reps} reps for your goal. ${equipmentNote}`;
  return { target, routine, minutes, level, note };
}
