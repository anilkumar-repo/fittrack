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

const REGION_ORDER: BodyRegion[] = ["thighs", "hips", "hamstrings", "chest", "back", "shoulders", "arms", "forearms", "core", "calves"];

/** Body regions a set of exercises works, most-used first. */
export function regionsForExercises(exercises: Array<{ movementPattern?: MovementPattern }>): BodyRegion[] {
  const counts = new Map<BodyRegion, number>();
  for (const exercise of exercises) {
    for (const region of exercise.movementPattern ? PATTERN_REGIONS[exercise.movementPattern] : []) counts.set(region, (counts.get(region) ?? 0) + 1);
  }
  return [...counts.keys()].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || REGION_ORDER.indexOf(a) - REGION_ORDER.indexOf(b));
}
