import type { MovementPattern } from "./types";

/** Which body drawing the app shows. A display choice only; it never changes the training plan. */
export type FigureChoice = "female" | "male" | "neutral";

export const FIGURE_OPTIONS: Array<{ id: FigureChoice; label: string }> = [
  { id: "female", label: "Female" },
  { id: "male", label: "Male" },
  { id: "neutral", label: "Neutral" },
];

/** Areas of the front-view figure that can be highlighted. */
export type BodyRegion = "shoulders" | "chest" | "arms" | "forearms" | "core" | "hips" | "thighs" | "calves";

export function isFigureChoice(value: unknown): value is FigureChoice {
  return value === "female" || value === "male" || value === "neutral";
}

export const REGION_LABELS: Record<BodyRegion, string> = {
  shoulders: "Shoulders", chest: "Chest", arms: "Arms", forearms: "Forearms", core: "Core", hips: "Glutes", thighs: "Legs", calves: "Calves",
};

/** The figure is drawn from the front, so pulling movements show on the arms rather than the back. */
const PATTERN_REGIONS: Record<MovementPattern, BodyRegion[]> = {
  squat: ["thighs", "hips"],
  single_leg: ["thighs", "hips"],
  horizontal_push: ["chest", "shoulders", "arms"],
  vertical_push: ["shoulders", "arms"],
  horizontal_pull: ["arms", "forearms"],
  vertical_pull: ["arms", "forearms"],
  hip_extension: ["hips", "thighs"],
  hamstring_curl: ["thighs"],
  core: ["core"],
  carry: ["forearms", "core"],
  recovery: [],
};

const REGION_ORDER: BodyRegion[] = ["thighs", "hips", "chest", "shoulders", "arms", "forearms", "core", "calves"];

/** Body regions a set of exercises works, most-used first. */
export function regionsForExercises(exercises: Array<{ movementPattern?: MovementPattern }>): BodyRegion[] {
  const counts = new Map<BodyRegion, number>();
  for (const exercise of exercises) {
    for (const region of exercise.movementPattern ? PATTERN_REGIONS[exercise.movementPattern] : []) counts.set(region, (counts.get(region) ?? 0) + 1);
  }
  return [...counts.keys()].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || REGION_ORDER.indexOf(a) - REGION_ORDER.indexOf(b));
}
