import type { BodyRegion, FigureChoice } from "./figure.ts";

/** File name for each muscle group's picture in public/figures/v3 (made by scripts/build-figures.mjs). */
const REGION_FILES: Record<BodyRegion, string> = {
  shoulders: "shoulders", chest: "chest", back: "back", arms: "arms", forearms: "forearms",
  core: "core", hips: "glutes", thighs: "quads", hamstrings: "hamstrings", calves: "calves",
};

/** Muscle groups seen from one side only are pictured with just that view. */
const SINGLE_VIEW = new Set<BodyRegion>(["chest", "core", "thighs", "back", "hips", "hamstrings"]);

/** The side where each one-sided muscle group cannot be seen: that view shows the plain body. */
const HIDDEN_SIDE: Partial<Record<BodyRegion, Side>> = {
  chest: "back", core: "back", thighs: "back", back: "front", hips: "front", hamstrings: "front",
};

/** The picture folder is versioned, so phones never keep an older cached copy (pictures are cached for 30 days). */
const DIR = "/figures/v3/";
const HEIGHT = 820;
/** Width of a one-figure picture; the front + back pictures are twice as wide. */
const SINGLE_WIDTH = 489;

/** Every figure choice has a full picture set. */
const PICTURED = new Set<FigureChoice>(["female", "male", "neutral"]);

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
  return { src: `${DIR}${figure}-${name}.webp`, width: single ? SINGLE_WIDTH : SINGLE_WIDTH * 2, height: HEIGHT };
}

/** Paths inside public/figures of every picture a muscle group can show. */
export function pictureFileNames(): string[] {
  return [...PICTURED].flatMap((figure) => ["base", ...Object.values(REGION_FILES)].map((name) => `v3/${figure}-${name}.webp`));
}

export type Side = "front" | "back";

/**
 * Figures that have the side view (recovery map): a plain side picture and one per muscle group, built by
 * scripts/build-figures.mjs, with masks from scripts/build-recovery-masks.mjs. Add a figure here once its side
 * pictures are in public/figures/v3 (a test checks every file exists). Until then the map shows Front and Back only.
 */
export const SIDE_VIEW_FIGURES: readonly FigureChoice[] = [];

export function hasSideView(figure: FigureChoice): boolean {
  return SIDE_VIEW_FIGURES.includes(figure);
}

/** Muscle groups seen mainly from behind start the turnable figure on its back view. */
const BACK_FIRST = new Set<BodyRegion>(["back", "hips", "hamstrings", "calves"]);

export function startingSide(region?: BodyRegion): Side {
  return region && BACK_FIRST.has(region) ? "back" : "front";
}

/** One side of the body, for the figure that turns around in the exercise guide. */
export function sidePicture(figure: FigureChoice, side: Side, region?: BodyRegion): MusclePicture | null {
  if (!PICTURED.has(figure)) return null;
  const name = region && HIDDEN_SIDE[region] !== side ? REGION_FILES[region] : "base";
  return { src: `${DIR}${figure}-${name}-${side}.webp`, width: SINGLE_WIDTH, height: HEIGHT };
}

export function sidePictureFileNames(): string[] {
  return [...PICTURED].flatMap((figure) => (["base", ...Object.keys(REGION_FILES)] as Array<"base" | BodyRegion>).flatMap((region) =>
    (["front", "back"] as Side[]).map((side) => sidePicture(figure, side, region === "base" ? undefined : region)?.src.replace("/figures/", "") ?? "")));
}
