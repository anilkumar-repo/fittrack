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
};


/** Exercises whose movement pattern does not describe the muscles they mainly use. */
const EXERCISE_REGIONS: Record<string, BodyRegion[]> = {
  march_in_place: ["thighs", "calves"],
  comfortable_walk: ["thighs", "calves"],
  relaxed_breathing: ["core"],
  farmer_carry: ["forearms", "core", "back"],
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
