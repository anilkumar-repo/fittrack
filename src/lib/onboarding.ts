import type { BodyRegion } from "./figure.ts";
import type { EquipmentKey } from "./types";

/** Phase 2 (2026-11-17): the extra onboarding answers and what they mean for the plan. */
export type FocusArea = "balanced" | "chest" | "back" | "shoulders" | "arms" | "legs" | "glutes" | "core";
export type GymType = "large_gym" | "small_gym" | "home" | "bodyweight";

export const FOCUS_OPTIONS: Array<{ id: FocusArea; label: string; note: string; regions: BodyRegion[] }> = [
  { id: "balanced", label: "Balanced", note: "Everything evenly", regions: [] },
  { id: "chest", label: "Chest", note: "Push strength", regions: ["chest"] },
  { id: "back", label: "Back", note: "Posture and pulling", regions: ["back"] },
  { id: "shoulders", label: "Shoulders", note: "Strong, stable shoulders", regions: ["shoulders"] },
  { id: "arms", label: "Arms", note: "Biceps and triceps", regions: ["arms", "forearms"] },
  { id: "legs", label: "Legs", note: "Quads, hamstrings, calves", regions: ["thighs", "hamstrings", "calves"] },
  { id: "glutes", label: "Glutes", note: "Hips and glutes", regions: ["hips"] },
  { id: "core", label: "Core", note: "Abs and lower back", regions: ["core"] },
];

/** "How active is your typical day?" (outside workouts). Used for the water target, stretch suggestions and Rozi. */
export type DailyActivity = "seated" | "light" | "on_feet" | "active";
export const ACTIVITY_OPTIONS: Array<{ id: DailyActivity; label: string; note: string; waterMl: number }> = [
  { id: "seated", label: "Mostly seated", note: "Desk work, studying, driving", waterMl: 0 },
  { id: "light", label: "Lightly active", note: "Some walking and standing", waterMl: 0 },
  { id: "on_feet", label: "Often on my feet", note: "Teaching, retail, lots of walking", waterMl: 250 },
  { id: "active", label: "Physically active work", note: "Construction, deliveries, farm work", waterMl: 500 },
];
export const ACTIVITY_IDS = new Set<string>(ACTIVITY_OPTIONS.map((option) => option.id));

export function focusRegions(focus: FocusArea | undefined): BodyRegion[] {
  return FOCUS_OPTIONS.find((option) => option.id === focus)?.regions ?? [];
}

export const GYM_OPTIONS: Array<{ id: GymType; label: string; note: string; equipment: EquipmentKey[] }> = [
  { id: "large_gym", label: "Large gym", note: "Free weights, machines, cables and cardio", equipment: ["dumbbells", "bench", "cable_machine", "leg_press", "leg_curl_machine", "rack", "mat", "barbell", "smith_machine", "gym_machines", "pullup_bar", "step", "back_extension", "cardio_machine"] },
  { id: "small_gym", label: "Small gym", note: "Dumbbells, a bench, a rack and a few machines", equipment: ["dumbbells", "bench", "rack", "mat", "barbell", "gym_machines", "pullup_bar", "cardio_machine"] },
  { id: "home", label: "Home", note: "Dumbbells, a mat and a sturdy chair", equipment: ["dumbbells", "mat", "chair", "step"] },
  { id: "bodyweight", label: "Bodyweight only", note: "No equipment at all", equipment: [] },
];

export function gymPreset(gym: GymType): EquipmentKey[] {
  return GYM_OPTIONS.find((option) => option.id === gym)?.equipment ?? [];
}

/** Honest, general "did you know" lines (no made-up statistics). */
export const DID_YOU_KNOW = [
  { title: "Most people quit when the plan doesn’t fit their week", text: "RozFit builds around the days you pick and never piles missed workouts onto the next day." },
  { title: "Consistency beats intensity", text: "Three steady sessions a week, done for months, change more than one perfect week." },
  { title: "Rest days are training days too", text: "Muscles get stronger while you recover. Rozi plans rest on purpose." },
];

/** Picture of each piece of equipment (public/equipment/v1, built by scripts/build-art.mjs). */
export function equipmentPicture(id: EquipmentKey): string {
  return `/equipment/v1/${id}.webp`;
}

/** Photo for each "where you train" choice (public/gyms/v1). */
export function gymPicture(id: GymType): string {
  return `/gyms/v1/${id}.webp`;
}
