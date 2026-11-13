import type { BodyRegion, FigureChoice } from "./figure.ts";

/** File name for each muscle group's picture in public/figures. */
const REGION_FILES: Record<BodyRegion, string> = {
  shoulders: "shoulders", chest: "chest", back: "back", arms: "arms", forearms: "forearms",
  core: "core", hips: "glutes", thighs: "quads", hamstrings: "hamstrings", calves: "calves",
};

/** Muscle groups seen from one side only are pictured with just that view. */
const SINGLE_VIEW = new Set<BodyRegion>(["chest", "core", "thighs", "back", "hips", "hamstrings"]);

/** Pictured figures. "neutral" has no pictures and uses the drawn figure instead. */
const PICTURED = new Set<FigureChoice>(["female", "male"]);

export interface MusclePicture {
  src: string;
  /** Size of the image file in pixels, so the page can reserve the right space. */
  width: number;
  height: number;
}

/** The picture for one muscle group (or the plain body when region is omitted), or null if there is none. */
export function musclePicture(figure: FigureChoice, region?: BodyRegion): MusclePicture | null {
  if (!PICTURED.has(figure)) return null;
  const name = region ? REGION_FILES[region] : "base";
  const single = region ? SINGLE_VIEW.has(region) : false;
  return { src: `/figures/${figure}-${name}.webp`, width: single ? 380 : 760, height: 820 };
}

export function pictureFileNames(): string[] {
  return [...PICTURED].flatMap((figure) => ["base", ...Object.values(REGION_FILES)].map((name) => `${figure}-${name}.webp`));
}

export type Side = "front" | "back";

/** Muscle groups seen mainly from behind start the turnable figure on its back view. */
const BACK_FIRST = new Set<BodyRegion>(["back", "hips", "hamstrings", "calves"]);

export function startingSide(region?: BodyRegion): Side {
  return region && BACK_FIRST.has(region) ? "back" : "front";
}

/** One side of the body, for the figure that turns around in the exercise guide. */
export function sidePicture(figure: FigureChoice, side: Side, region?: BodyRegion): MusclePicture | null {
  if (!PICTURED.has(figure)) return null;
  const name = region ? REGION_FILES[region] : "base";
  return { src: `/figures/${figure}-${name}-${side}.webp`, width: 380, height: 820 };
}

export function sidePictureFileNames(): string[] {
  return pictureFileNames().flatMap((file) => ["front", "back"].map((side) => file.replace(".webp", `-${side}.webp`)));
}
