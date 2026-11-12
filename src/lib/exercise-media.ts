/**
 * Reference media for the exercise library.
 *
 * Illustrations are simple stick-figure position guides drawn for FitTrack from the pose data below,
 * so there is no third-party image, licence, or attribution to manage. Angles are in degrees on the
 * screen: 0 points right (the way the figure faces), 90 down, 180 left, 270 up.
 */

export type Joint = "head" | "shoulder" | "hip" | "knee" | "foot" | "knee2" | "foot2" | "elbow" | "hand" | "elbow2" | "hand2";

export type Prop =
  | { kind: "rect"; x: number; y: number; w: number; h: number }
  | { kind: "line"; x1: number; y1: number; x2: number; y2: number }
  | { kind: "wall"; x: number }
  | { kind: "under"; joint: Joint; w: number; dx?: number; dy?: number }
  | { kind: "weight"; joint: Joint }
  | { kind: "cable"; joint: Joint; to: "up" | "right" }
  | { kind: "plate"; joint: Joint };

export interface Pose {
  /** One joint pinned to a point in the 100 × 100 frame; the floor is at y = 90. */
  anchor: [Joint, number, number];
  torso: number;
  neck?: number;
  thigh: number;
  shin: number;
  thigh2?: number;
  shin2?: number;
  upper: number;
  fore: number;
  upper2?: number;
  fore2?: number;
  props?: Prop[];
}

export interface ExerciseIllustration {
  start: Pose;
  /** Omitted for holds, which show one position. */
  finish?: Pose;
}

const LENGTHS = { thigh: 20, shin: 20, torso: 25, neck: 9, upper: 13, fore: 12 };
export const FLOOR_Y = 90;

function step(from: [number, number], angle: number, length: number): [number, number] {
  const radians = (angle * Math.PI) / 180;
  return [from[0] + Math.cos(radians) * length, from[1] + Math.sin(radians) * length];
}

/** Works out where every joint sits for a pose. */
export function poseJoints(pose: Pose): Record<Joint, [number, number]> {
  const hip: [number, number] = [0, 0];
  const shoulder = step(hip, pose.torso, LENGTHS.torso);
  const knee = step(hip, pose.thigh, LENGTHS.thigh);
  const knee2 = step(hip, pose.thigh2 ?? pose.thigh, LENGTHS.thigh);
  const elbow = step(shoulder, pose.upper, LENGTHS.upper);
  const elbow2 = step(shoulder, pose.upper2 ?? pose.upper, LENGTHS.upper);
  const joints: Record<Joint, [number, number]> = {
    hip, shoulder, knee, knee2, elbow, elbow2,
    head: step(shoulder, pose.neck ?? pose.torso, LENGTHS.neck),
    foot: step(knee, pose.shin, LENGTHS.shin),
    foot2: step(knee2, pose.shin2 ?? pose.shin, LENGTHS.shin),
    hand: step(elbow, pose.fore, LENGTHS.fore),
    hand2: step(elbow2, pose.fore2 ?? pose.fore, LENGTHS.fore),
  };
  const [anchorJoint, x, y] = pose.anchor;
  const dx = x - joints[anchorJoint][0];
  const dy = y - joints[anchorJoint][1];
  for (const key of Object.keys(joints) as Joint[]) joints[key] = [joints[key][0] + dx, joints[key][1] + dy];
  return joints;
}

const seat: Prop = { kind: "rect", x: 30, y: 73, w: 24, h: 17 };
const seatBack: Prop = { kind: "rect", x: 29, y: 44, w: 3, h: 29 };
const supine = { anchor: ["shoulder", 25, 87] as [Joint, number, number], neck: 180 };
const prone = { anchor: ["hip", 55, 86] as [Joint, number, number], torso: 180, neck: 185, thigh: 0, shin: 0 };
const standing = { anchor: ["foot", 50, 90] as [Joint, number, number], torso: 270, thigh: 90, shin: 90 };
const squatting = { anchor: ["foot", 55, 90] as [Joint, number, number], torso: 288, thigh: 15, shin: 105 };
const sitting = { anchor: ["foot", 62, 90] as [Joint, number, number], torso: 270, thigh: 0, shin: 90 };
const splitHigh = { anchor: ["hip", 50, 52] as [Joint, number, number], torso: 270, thigh: 60, shin: 85, thigh2: 115, shin2: 120 };
const splitLow = { anchor: ["hip", 50, 62] as [Joint, number, number], torso: 270, thigh: 30, shin: 105, thigh2: 100, shin2: 165 };
const strideA = { anchor: ["hip", 50, 51] as [Joint, number, number], torso: 272, thigh: 75, shin: 95, thigh2: 105, shin2: 112 };
const strideB = { anchor: ["hip", 50, 51] as [Joint, number, number], torso: 272, thigh: 105, shin: 112, thigh2: 75, shin2: 95 };
const support: Prop = { kind: "wall", x: 76 };

const ILLUSTRATIONS: Record<string, ExerciseIllustration> = {
  goblet_squat: {
    start: { ...standing, upper: 60, fore: 300, props: [{ kind: "weight", joint: "hand" }] },
    finish: { ...squatting, upper: 70, fore: 300, props: [{ kind: "weight", joint: "hand" }] },
  },
  bodyweight_squat: {
    start: { ...standing, upper: 85, fore: 85 },
    finish: { ...squatting, upper: 350, fore: 350 },
  },
  sit_to_stand: {
    start: { ...sitting, torso: 278, upper: 60, fore: 20, props: [seat, seatBack] },
    finish: { ...standing, anchor: ["foot", 64, 90], upper: 85, fore: 85, props: [seat, seatBack] },
  },
  leg_press: {
    start: { anchor: ["hip", 38, 80], torso: 215, thigh: 300, shin: 10, upper: 70, fore: 20, props: [{ kind: "rect", x: 26, y: 84, w: 24, h: 6 }, { kind: "line", x1: 33, y1: 82, x2: 14, y2: 68 }, { kind: "plate", joint: "foot" }] },
    finish: { anchor: ["hip", 38, 80], torso: 215, thigh: 335, shin: 335, upper: 70, fore: 20, props: [{ kind: "rect", x: 26, y: 84, w: 24, h: 6 }, { kind: "line", x1: 33, y1: 82, x2: 14, y2: 68 }, { kind: "plate", joint: "foot" }] },
  },
  dumbbell_bench: {
    start: { anchor: ["hip", 56, 64], torso: 180, neck: 180, thigh: 15, shin: 90, upper: 350, fore: 270, props: [{ kind: "rect", x: 18, y: 67, w: 44, h: 5 }, { kind: "rect", x: 24, y: 72, w: 3, h: 18 }, { kind: "rect", x: 54, y: 72, w: 3, h: 18 }, { kind: "weight", joint: "hand" }] },
    finish: { anchor: ["hip", 56, 64], torso: 180, neck: 180, thigh: 15, shin: 90, upper: 270, fore: 270, props: [{ kind: "rect", x: 18, y: 67, w: 44, h: 5 }, { kind: "rect", x: 24, y: 72, w: 3, h: 18 }, { kind: "rect", x: 54, y: 72, w: 3, h: 18 }, { kind: "weight", joint: "hand" }] },
  },
  lat_pulldown: {
    start: { ...sitting, upper: 285, fore: 275, props: [seat, { kind: "cable", joint: "hand", to: "up" }] },
    finish: { ...sitting, torso: 265, upper: 70, fore: 290, props: [seat, { kind: "cable", joint: "hand", to: "up" }] },
  },
  seated_row: {
    start: { ...sitting, torso: 275, upper: 10, fore: 5, props: [seat, { kind: "cable", joint: "hand", to: "right" }] },
    finish: { ...sitting, upper: 125, fore: 5, props: [seat, { kind: "cable", joint: "hand", to: "right" }] },
  },
  shoulder_press: {
    start: { ...sitting, upper: 80, fore: 280, props: [seat, seatBack, { kind: "weight", joint: "hand" }] },
    finish: { ...sitting, upper: 275, fore: 270, props: [seat, seatBack, { kind: "weight", joint: "hand" }] },
  },
  hamstring_curl: {
    start: { anchor: ["hip", 42, 68], torso: 268, thigh: 0, shin: 20, upper: 80, fore: 10, props: [{ kind: "rect", x: 30, y: 71, w: 26, h: 19 }, seatBack, { kind: "weight", joint: "foot" }] },
    finish: { anchor: ["hip", 42, 68], torso: 268, thigh: 0, shin: 115, upper: 80, fore: 10, props: [{ kind: "rect", x: 30, y: 71, w: 26, h: 19 }, seatBack, { kind: "weight", joint: "foot" }] },
  },
  plank: {
    start: { anchor: ["foot", 15, 90], torso: 335, thigh: 155, shin: 155, upper: 90, fore: 0, props: [{ kind: "under", joint: "elbow", w: 28, dx: 6 }] },
  },
  wall_plank: {
    start: { anchor: ["foot", 35, 90], torso: 290, thigh: 110, shin: 110, upper: 0, fore: 270, props: [{ kind: "wall", x: 72 }] },
  },
  wall_pushup: {
    start: { anchor: ["foot", 39, 90], torso: 280, thigh: 100, shin: 100, upper: 355, fore: 355, props: [support] },
    finish: { anchor: ["foot", 35, 90], torso: 292, thigh: 112, shin: 112, upper: 60, fore: 320, props: [support] },
  },
  incline_pushup: {
    start: { anchor: ["foot", 12, 90], torso: 320, thigh: 140, shin: 140, upper: 85, fore: 85, props: [{ kind: "rect", x: 52, y: 73, w: 26, h: 17 }] },
    finish: { anchor: ["foot", 12, 90], torso: 330, thigh: 150, shin: 150, upper: 150, fore: 60, props: [{ kind: "rect", x: 52, y: 73, w: 26, h: 17 }] },
  },
  chest_row: {
    start: { anchor: ["foot", 15, 90], torso: 320, thigh: 140, shin: 140, upper: 90, fore: 90, props: [{ kind: "line", x1: 45, y1: 71, x2: 68, y2: 52 }, { kind: "rect", x: 55, y: 62, w: 3, h: 28 }, { kind: "weight", joint: "hand" }] },
    finish: { anchor: ["foot", 15, 90], torso: 320, thigh: 140, shin: 140, upper: 215, fore: 95, props: [{ kind: "line", x1: 45, y1: 71, x2: 68, y2: 52 }, { kind: "rect", x: 55, y: 62, w: 3, h: 28 }, { kind: "weight", joint: "hand" }] },
  },
  hip_thrust: {
    start: { anchor: ["shoulder", 28, 66], torso: 235, neck: 250, thigh: 330, shin: 55, upper: 100, fore: 95, props: [{ kind: "rect", x: 8, y: 68, w: 22, h: 22 }] },
    finish: { anchor: ["shoulder", 28, 66], torso: 190, neck: 195, thigh: 350, shin: 92, upper: 100, fore: 95, props: [{ kind: "rect", x: 8, y: 68, w: 22, h: 22 }] },
  },
  glute_bridge: {
    start: { ...supine, torso: 180, thigh: 305, shin: 75, upper: 5, fore: 0 },
    finish: { ...supine, torso: 160, thigh: 340, shin: 90, upper: 5, fore: 0 },
  },
  heel_dig_bridge: {
    start: { ...supine, torso: 180, thigh: 305, shin: 75, upper: 5, fore: 0 },
    finish: { ...supine, torso: 174, thigh: 315, shin: 80, upper: 5, fore: 0 },
  },
  dead_bug: {
    start: { anchor: ["hip", 52, 86], torso: 180, neck: 180, thigh: 270, shin: 0, upper: 270, fore: 270 },
    finish: { anchor: ["hip", 52, 86], torso: 180, neck: 180, thigh: 340, shin: 352, thigh2: 270, shin2: 0, upper: 200, fore: 195, upper2: 270, fore2: 270 },
  },
  split_squat: {
    start: { ...splitHigh, upper: 20, fore: 350, props: [support] },
    finish: { ...splitLow, upper: 340, fore: 330, props: [support] },
  },
  bodyweight_split_squat: {
    start: { ...splitHigh, upper: 20, fore: 350, props: [support] },
    finish: { ...splitLow, upper: 340, fore: 330, props: [support] },
  },
  farmer_carry: {
    start: { ...strideA, upper: 88, fore: 88, props: [{ kind: "weight", joint: "hand" }] },
    finish: { ...strideB, upper: 88, fore: 88, props: [{ kind: "weight", joint: "hand" }] },
  },
  march_in_place: {
    start: { ...standing, upper: 85, fore: 85 },
    finish: { anchor: ["foot2", 50, 90], torso: 270, thigh: 15, shin: 95, thigh2: 90, shin2: 90, upper: 120, fore: 80, upper2: 50, fore2: 350 },
  },
  comfortable_walk: {
    start: { ...strideA, upper: 110, fore: 80, upper2: 65, fore2: 50 },
    finish: { ...strideB, upper: 65, fore: 50, upper2: 110, fore2: 80 },
  },
  relaxed_breathing: {
    start: { ...supine, torso: 180, thigh: 305, shin: 75, upper: 20, fore: 300 },
  },
  prone_lat_pull: {
    start: { ...prone, upper: 180, fore: 180 },
    finish: { ...prone, upper: 345, fore: 205 },
  },
  prone_w_raise: {
    start: { ...prone, upper: 5, fore: 185 },
    finish: { ...prone, upper: 335, fore: 215 },
  },
  prone_y_raise: {
    start: { ...prone, upper: 180, fore: 180 },
    finish: { ...prone, upper: 200, fore: 200 },
  },
  wall_slide: {
    start: { ...standing, upper: 350, fore: 270, props: [{ kind: "wall", x: 42 }] },
    finish: { ...standing, upper: 310, fore: 290, props: [{ kind: "wall", x: 42 }] },
  },
  dumbbell_rdl: {
    start: { ...standing, upper: 88, fore: 88, props: [{ kind: "weight", joint: "hand" }] },
    finish: { anchor: ["foot", 46, 90], torso: 318, thigh: 97, shin: 86, upper: 90, fore: 90, props: [{ kind: "weight", joint: "hand" }] },
  },
};

export function getExerciseIllustration(exerciseId: string): ExerciseIllustration | undefined {
  return ILLUSTRATIONS[exerciseId];
}

/**
 * Demonstration videos chosen by the trainer, keyed by exercise ID. Add a full video address here
 * after watching it and confirming it matches the written steps. Exercises without an entry open a
 * video search instead, so a link is never invented.
 */
const TRAINER_DEMO_VIDEOS: Record<string, string> = {};

export interface DemoVideoLink {
  url: string;
  /** True when a trainer picked this exact video; false when it is a search for the exercise name. */
  curated: boolean;
}

export function getDemoVideoLink(exercise: { id: string; name: string }): DemoVideoLink {
  const curated = TRAINER_DEMO_VIDEOS[exercise.id];
  if (curated && /^https:\/\//.test(curated)) return { url: curated, curated: true };
  const query = `${exercise.name} exercise proper form for beginners`;
  return { url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, curated: false };
}
