import type { MovementPattern } from "./types";

/** Which body drawing the app shows. A display choice only; it never changes the training plan. */
export type FigureChoice = "female" | "male" | "neutral";

export const FIGURE_OPTIONS: Array<{ id: FigureChoice; label: string }> = [
  { id: "female", label: "Female" },
  { id: "male", label: "Male" },
  { id: "neutral", label: "Neutral" },
];

/** Areas of the front-view figure that can be highlighted. */
export type BodyRegion = "shoulders" | "chest" | "back" | "arms" | "forearms" | "core" | "hips" | "thighs" | "hamstrings" | "calves";

export function isFigureChoice(value: unknown): value is FigureChoice {
  return value === "female" || value === "male" || value === "neutral";
}

export const REGION_LABELS: Record<BodyRegion, string> = {
  shoulders: "Shoulders", chest: "Chest", back: "Back", arms: "Arms", forearms: "Forearms", core: "Core", hips: "Glutes", thighs: "Quads", hamstrings: "Hamstrings", calves: "Calves",
};

/** Main muscle groups for each movement pattern, as shown on the front-and-back figure. */
const PATTERN_REGIONS: Record<MovementPattern, BodyRegion[]> = {
  squat: ["thighs", "hips"],
  single_leg: ["thighs", "hips"],
  horizontal_push: ["chest", "shoulders", "arms"],
  vertical_push: ["shoulders", "arms"],
  horizontal_pull: ["back", "arms"],
  vertical_pull: ["back", "arms"],
  hip_extension: ["hips", "hamstrings"],
  hamstring_curl: ["hamstrings"],
  core: ["core"],
  carry: ["forearms", "back", "core"],
  recovery: [],
  shoulder_raise: ["shoulders"],
  chest_fly: ["chest", "shoulders"],
  arm_curl: ["arms", "forearms"],
  arm_extension: ["arms"],
  knee_extension: ["thighs"],
  calf_raise: ["calves"],
  cardio: ["thighs", "calves"],
};


/** Exercises whose movement pattern does not describe the muscles they mainly use. */
const EXERCISE_REGIONS: Record<string, BodyRegion[]> = {
  march_in_place: ["thighs", "calves"],
  comfortable_walk: ["thighs", "calves"],
  relaxed_breathing: ["core"],
  farmer_carry: ["forearms", "core", "back"],
  face_pull: ["shoulders", "back"],
  wrist_curl: ["forearms"],
  reverse_wrist_curl: ["forearms"],
  reverse_curl: ["forearms", "arms"],
  hammer_curl: ["arms", "forearms"],
  db_curl: ["arms"],
  ez_curl: ["arms"],
  preacher_curl: ["arms"],
  incline_db_curl: ["arms"],
  pushup: ["chest", "arms", "core"],
  hanging_knee_raise: ["core"],
  back_extension: ["hips", "hamstrings", "back"],
  bulgarian_split_squat: ["thighs", "hips"],
  // Batch A (R6)
  close_grip_bench: ["arms", "chest", "shoulders"],
  knee_pushup: ["chest", "arms", "core"],
  db_shrug: ["back", "shoulders"],
  conventional_deadlift: ["hips", "hamstrings", "back"],
  reverse_db_fly: ["shoulders", "back"],
  reverse_pec_deck: ["shoulders", "back"],
  band_pull_apart: ["shoulders", "back"],
  cable_curl: ["arms"],
  band_curl: ["arms"],
  dead_hang: ["forearms", "back"],
  // Batch B (R6)
  walking_lunge: ["thighs", "hips"],
  wall_sit: ["thighs"],
  single_leg_rdl: ["hamstrings", "hips"],
  barbell_hip_thrust: ["hips", "hamstrings"],
  single_leg_glute_bridge: ["hips", "hamstrings"],
  wood_chop: ["core", "shoulders"],
  mountain_climber: ["core", "shoulders", "thighs"],
  // Batch C (R6)
  rowing_machine: ["back", "thighs", "arms"],
  stationary_bike: ["thighs", "hips"],
  cycling: ["thighs", "hips"],
  jump_squat: ["thighs", "hips", "calves"],
  burpee: ["chest", "thighs", "core"],
  jump_rope: ["calves", "shoulders"],
  kettlebell_swing: ["hips", "hamstrings", "back"],
  // Batch D (2026-11-25)
  chest_dip: ["chest", "arms", "shoulders"],
  upright_row: ["shoulders", "back"],
  hip_adduction_machine: ["thighs", "hips"],
  hip_abduction_machine: ["hips"],
  sumo_deadlift: ["hips", "hamstrings", "back"],
  good_morning: ["hamstrings", "hips", "back"],
  cable_glute_kickback: ["hips", "hamstrings"],
  ab_wheel_rollout: ["core", "shoulders"],
  front_raise: ["shoulders"],
};

/** Body regions a set of exercises works, most-used first; ties keep the order they first appear. */
export function regionsForExercises(exercises: Array<{ id?: string; movementPattern?: MovementPattern }>): BodyRegion[] {
  const counts = new Map<BodyRegion, number>();
  for (const exercise of exercises) {
    const regions = (exercise.id && EXERCISE_REGIONS[exercise.id]) || (exercise.movementPattern ? PATTERN_REGIONS[exercise.movementPattern] : []);
    for (const region of regions) counts.set(region, (counts.get(region) ?? 0) + 1);
  }
  const firstSeen = [...counts.keys()];
  return firstSeen.sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || firstSeen.indexOf(a) - firstSeen.indexOf(b));
}
