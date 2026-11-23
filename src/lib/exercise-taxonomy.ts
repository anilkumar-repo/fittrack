import type { EquipmentKey, ExerciseTracking, TargetMuscle, TrackingUnit } from "./types";

/**
 * The exercise taxonomy (R3): controlled muscle values, other names and variation groups for the library.
 * The exercises themselves stay in templates.ts / program-exercises.ts with their IDs unchanged; this file only adds
 * structured data, applied when the library is built. exercise-taxonomy.test.ts checks it stays consistent.
 */

export const TARGET_MUSCLE_LABELS: Record<TargetMuscle, string> = {
  chest: "Chest",
  lats: "Lats",
  upper_back: "Upper back",
  traps: "Traps",
  lower_back: "Lower back",
  shoulders: "Shoulders",
  rear_shoulders: "Rear shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Forearms & grip",
  abs: "Abs",
  obliques: "Obliques",
  core: "Core",
  glutes: "Glutes",
  quads: "Quadriceps",
  hamstrings: "Hamstrings",
  hips: "Hips",
  calves: "Calves",
  cardio: "Heart & lungs",
  relaxation: "Relaxation",
};

/** Every muscle text used in the library → its controlled value. A new text must be added here (the test fails otherwise). */
const MUSCLE_TEXT: Record<string, TargetMuscle> = {
  "chest": "chest",
  "upper chest": "chest",
  "lats": "lats",
  "mid back": "upper_back",
  "upper back": "upper_back",
  "traps": "traps",
  "lower back": "lower_back",
  "back stabilizers": "lower_back",
  "shoulders": "shoulders",
  "front shoulders": "shoulders",
  "side shoulders": "shoulders",
  "rear shoulders": "rear_shoulders",
  "biceps": "biceps",
  "triceps": "triceps",
  "triceps (long head)": "triceps",
  "forearms": "forearms",
  "grip": "forearms",
  "abs": "abs",
  "deep abdominals": "abs",
  "obliques": "obliques",
  "core": "core",
  "glutes": "glutes",
  "quadriceps": "quads",
  "legs": "quads", // general leg work in cardio (walk, bike)
  "hamstrings": "hamstrings",
  "hip flexors": "hips",
  "hips": "hips",
  "calves": "calves",
  "heart and lungs": "cardio",
  "no specific muscle focus": "relaxation",
};

/** The controlled value for a muscle text from the library, or null if it isn't known yet. */
export function muscleKey(text: string): TargetMuscle | null {
  return MUSCLE_TEXT[text.trim().toLowerCase()] ?? null;
}

/** Controlled values for an exercise's muscle texts, main muscle first, without repeats. */
export function musclesFor(texts: string[]): TargetMuscle[] {
  return [...new Set(texts.map(muscleKey).filter((key): key is TargetMuscle => key !== null))];
}

/**
 * Other names people type, by exercise ID, when the name itself doesn't already contain them. Each alias belongs to
 * one exercise only. They count as a name match in search (exerciseSearchRank), so ties are still settled by what
 * the person logged and their equipment. They replace the short
 * list that used to live in rozi-ai/tools.ts, so search, swaps and Rozi all understand the same names.
 */
export const EXERCISE_ALIASES: Record<string, string[]> = {
  barbell_bench: ["bench", "barbell bench", "flat bench press", "bb bench"],
  dumbbell_bench: ["dumbbell chest press", "db bench press", "db bench", "dumbbell flat bench press"],
  incline_db_press: ["incline dumbbell bench press", "incline db press"],
  pec_deck: ["pec deck fly", "pec fly", "butterfly machine", "chest fly machine"],
  dumbbell_fly: ["dumbbell chest fly", "db fly"],
  cable_fly: ["cable crossover"],
  pushup: ["pushup", "press-up", "press up"],
  shoulder_press: ["dumbbell shoulder press", "seated dumbbell shoulder press", "db shoulder press", "dumbbell overhead press"],
  lateral_raise: ["side raise", "side lateral raise", "db lateral raise"],
  lat_pulldown: ["lat pull down", "lat pull-down", "wide-grip pulldown", "close-grip pulldown", "neutral-grip pulldown"],
  assisted_pullup: ["assisted pullup", "assisted chin-up", "band-assisted pull-up"],
  barbell_row: ["bent-over row", "bent over row", "barbell bent-over row", "pendlay row"],
  one_arm_db_row: ["dumbbell row", "single-arm dumbbell row", "one arm row", "db row"],
  chest_row: ["chest-supported dumbbell row", "incline dumbbell row"],
  face_pull: ["rope face pull"],
  db_curl: ["curl", "bicep curl", "alternating dumbbell curl", "seated dumbbell curl", "db curl"],
  hammer_curl: ["cross-body hammer curl"],
  ez_curl: ["ez curl", "ez bar curl"],
  reverse_curl: ["reverse barbell curl", "reverse ez-bar curl"],
  triceps_pushdown: ["tricep pushdown", "straight-bar pushdown"],
  rope_pushdown: ["tricep rope pushdown"],
  db_triceps_extension: ["overhead dumbbell triceps extension", "overhead tricep extension"],
  back_squat: ["squat", "back squat", "barbell back squat"],
  barbell_rdl: ["rdl", "romanian deadlift", "stiff-legged deadlift", "stiff leg deadlift", "bb rdl"],
  dumbbell_rdl: ["dumbbell rdl", "db rdl"],
  hamstring_curl: ["leg curl", "seated leg curl", "lying leg curl"],
  calf_raise: ["calf raise", "bodyweight calf raise"],
  floor_plank: ["front plank", "forearm plank"],
  hanging_knee_raise: ["captain's chair knee raise", "captains chair"],
  hip_thrust: ["hip thrust"],
  farmer_carry: ["farmer's carry", "farmers carry", "farmer walk", "farmers walk"],
  easy_cardio: ["steady-state cardio", "steady state cardio", "treadmill", "stationary bike", "elliptical"],
  interval_cardio: ["interval training", "intervals", "hiit"],
  comfortable_walk: ["walk", "walking"],
  march_in_place: ["marching in place", "march in place", "low-impact marching"],
  // Batch A (R6)
  machine_chest_press: ["chest press machine", "seated chest press"],
  barbell_incline_bench: ["incline barbell press", "incline bench press"],
  close_grip_bench: ["close grip bench", "cgbp"],
  knee_pushup: ["kneeling push-up", "kneeling pushup"],
  pullup: ["pullup"],
  chinup: ["chinup"],
  inverted_row: ["australian pull-up", "bodyweight row", "table row"],
  conventional_deadlift: ["deadlift", "barbell deadlift"],
  db_shrug: ["trap shrugs"],
  barbell_ohp: ["ohp", "military press", "standing press", "standing overhead press"],
  reverse_db_fly: ["rear delt fly", "bent-over reverse fly", "rear delt raise"],
  reverse_pec_deck: ["rear delt machine", "reverse fly machine"],
  band_pull_apart: ["pull apart", "pull-aparts"],
  skull_crusher: ["lying triceps extension", "ez-bar lying triceps extension", "french press"],
  bench_dips: ["chair dips", "triceps dips"],
  dead_hang: ["bar hang", "passive hang"],
  // Batch B (R6)
  walking_lunge: ["dumbbell walking lunge", "lunges"],
  wall_sit: ["wall squat hold"],
  single_leg_rdl: ["single-leg rdl", "sl rdl", "one-leg deadlift"],
  barbell_hip_thrust: ["loaded hip thrust", "barbell glute bridge"],
  single_leg_glute_bridge: ["one-leg glute bridge", "single leg bridge"],
  single_leg_calf_raise: ["one-leg calf raise"],
  crunch: ["crunches", "ab crunch"],
  bicycle_crunch: ["bicycles", "bicycle kicks"],
  lying_leg_raise: ["leg raises", "floor leg raise"],
  russian_twist: ["russian twists", "seated twist"],
  wood_chop: ["woodchop", "cable chop", "wood chopper"],
  mountain_climber: ["mountain climbers"],
};

/**
 * Other equipment that works instead of an exercise's required equipment (each entry is a full set). The exercise is
 * usable when its required equipment OR any one of these sets is available.
 */
export const EQUIPMENT_ALTERNATIVES: Record<string, EquipmentKey[][]> = {
  goblet_squat: [["kettlebell"]],
  farmer_carry: [["kettlebell"]],
  pallof_press: [["resistance_band"]],
  inverted_row: [["smith_machine"]],
  skull_crusher: [["dumbbells", "bench"]],
  bench_dips: [["chair"]],
  wood_chop: [["resistance_band"], ["dumbbells"]],
};

/** Cardio that can also log a distance. */
const DISTANCE_EXERCISES = new Set(["comfortable_walk", "easy_cardio"]);

/** The unit an exercise's reps text uses: "8 rounds: …" → rounds, "10 min" → minutes, "30 sec" → seconds, else reps. */
export function unitFromReps(reps: string): TrackingUnit {
  const text = reps.toLowerCase();
  if (/\bround/.test(text)) return "rounds";
  if (/\bmin\b|\bminutes?\b/.test(text)) return "minutes";
  if (/\bsec\b|\bseconds?\b/.test(text)) return "seconds";
  return "reps";
}

/** How an exercise's sets are counted, from its default reps text (the test checks every template agrees). */
export function trackingFor(id: string, reps: string): ExerciseTracking {
  const unit = unitFromReps(reps);
  return DISTANCE_EXERCISES.has(id) ? { unit, distance: true } : { unit };
}

/** Variation groups: versions of the same movement, for "try a variation" suggestions. Every group has 2+ members. */
export const VARIATION_GROUPS: Record<string, string[]> = {
  bench_press: ["barbell_bench", "dumbbell_bench", "incline_db_press", "barbell_incline_bench", "close_grip_bench", "db_floor_press", "machine_chest_press"],
  push_up: ["pushup", "incline_pushup", "wall_pushup", "knee_pushup"],
  chest_fly: ["cable_fly", "pec_deck", "dumbbell_fly"],
  shoulder_press: ["shoulder_press", "machine_shoulder_press", "barbell_ohp", "pike_pushup"],
  rear_delt: ["reverse_db_fly", "reverse_pec_deck", "band_pull_apart", "face_pull"],
  lateral_raise: ["lateral_raise", "cable_lateral_raise"],
  row: ["barbell_row", "one_arm_db_row", "chest_row", "seated_row", "single_arm_cable_row", "machine_row", "inverted_row", "band_row"],
  pulldown: ["lat_pulldown", "straight_arm_pulldown", "prone_lat_pull"],
  pull_up: ["pullup", "chinup", "assisted_pullup"],
  biceps_curl: ["db_curl", "ez_curl", "incline_db_curl", "preacher_curl", "hammer_curl", "cable_curl", "band_curl"],
  triceps_pushdown: ["triceps_pushdown", "rope_pushdown"],
  triceps_extension: ["overhead_cable_extension", "db_triceps_extension", "skull_crusher"],
  wrist_curl: ["wrist_curl", "reverse_wrist_curl"],
  squat: ["back_squat", "smith_squat", "hack_squat", "goblet_squat", "bodyweight_squat", "sit_to_stand", "wall_sit"],
  split_squat: ["split_squat", "bodyweight_split_squat", "bulgarian_split_squat", "reverse_lunge", "walking_lunge"],
  deadlift: ["barbell_rdl", "dumbbell_rdl", "conventional_deadlift", "single_leg_rdl"],
  glute_bridge: ["glute_bridge", "db_glute_bridge", "hip_thrust", "barbell_hip_thrust", "single_leg_glute_bridge"],
  calf_raise: ["calf_raise", "single_leg_calf_raise"],
  leg_curl: ["hamstring_curl", "slider_leg_curl", "heel_dig_bridge"],
  plank: ["floor_plank", "plank", "wall_plank", "mountain_climber"],
  crunch: ["reverse_crunch", "cable_crunch", "crunch", "bicycle_crunch"],
  leg_raise: ["hanging_knee_raise", "lying_leg_raise"],
  rotation: ["pallof_press", "russian_twist", "wood_chop"],
  cardio: ["easy_cardio", "interval_cardio", "comfortable_walk", "march_in_place"],
};

const GROUP_OF = new Map(Object.entries(VARIATION_GROUPS).flatMap(([group, ids]) => ids.map((id) => [id, group] as const)));

/** The variation group an exercise belongs to, if any. */
export function variationGroupOf(id: string): string | undefined {
  return GROUP_OF.get(id);
}
