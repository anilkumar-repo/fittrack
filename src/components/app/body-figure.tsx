import type { BodyRegion, FigureChoice } from "@/lib/figure";

/**
 * An anatomical-style body drawn for RozFit: a smooth silhouette with separate muscle shapes,
 * seen from the front and the back. Shapes are written once for the viewer's left half and mirrored.
 * The drawing is 200 units wide and 440 tall; the body's centre line is x = 100.
 */

/** How far each figure's outline sits from the centre, compared with the neutral figure. */
const BUILD: Record<FigureChoice, { shoulders: number; waist: number; hips: number; legs: number; hair: boolean }> = {
  female: { shoulders: 0.88, waist: 0.88, hips: 1.08, legs: 1.03, hair: true },
  male: { shoulders: 1.07, waist: 1.0, hips: 0.95, legs: 1.0, hair: false },
  neutral: { shoulders: 1, waist: 0.96, hips: 1, legs: 1, hair: false },
};

type Build = (typeof BUILD)[FigureChoice];

function widthAt(build: Build, y: number): number {
  const lerp = (a: number, b: number, from: number, to: number) => a + (b - a) * Math.min(1, Math.max(0, (y - from) / (to - from)));
  if (y < 110) return build.shoulders;
  if (y < 170) return lerp(build.shoulders, build.waist, 110, 170);
  if (y < 205) return lerp(build.waist, build.hips, 170, 205);
  if (y < 260) return build.hips;
  if (y < 330) return lerp(build.hips, build.legs, 260, 330);
  return build.legs;
}

/** Moves every point toward or away from the centre line to give each figure its proportions. */
function shape(d: string, build: Build): string {
  return d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x: string, y: string) => `${(100 - (100 - Number(x)) * widthAt(build, Number(y))).toFixed(1)} ${y}`);
}

/** Arms keep their shape and follow the shoulders in or out. */
function arm(d: string, build: Build): string {
  const shift = 50 * (1 - build.shoulders);
  return d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x: string, y: string) => `${(Number(x) + shift).toFixed(1)} ${y}`);
}

const BODY = {
  neck: "M90 46 L110 46 L112 66 L88 66 Z",
  torso: "M100 58 L90 62 Q74 66 62 70 Q50 74 50 86 L56 104 Q60 124 63 144 Q67 160 68 172 Q65 186 65 198 L100 206 Z",
  leg: "M66 190 Q59 216 60 242 Q61 276 69 304 L73 318 Q70 336 70 352 Q70 380 76 400 L79 412 L95 412 L95 398 Q97 370 96 345 Q96 325 94 312 Q98 290 98 262 Q99 240 100 222 L100 196 Z",
  foot: "M77 406 Q68 418 71 427 L96 427 L96 406 Z",
};
const ARM = {
  limb: "M50 72 Q38 76 40 96 Q37 128 34 160 Q31 196 26 234 L41 236 Q45 200 48 166 Q52 136 56 104 Q57 86 54 74 Z",
  hand: "M26 230 Q19 250 23 266 Q30 274 37 268 Q43 252 42 232 Z",
};

interface Muscle { region?: BodyRegion; d: string; onArm?: boolean }

const FRONT: Muscle[] = [
  { region: "shoulders", d: "M55 70 Q41 74 40 94 Q42 106 45 114 Q50 102 56 92 Q61 80 63 72 Z", onArm: true },
  { region: "chest", d: "M98 76 L67 76 Q58 84 58 100 Q64 116 80 119 Q92 120 98 113 Z" },
  { region: "arms", d: "M45 114 Q40 134 39 154 Q44 161 49 157 Q53 137 55 114 Q50 107 45 114 Z", onArm: true },
  { region: "forearms", d: "M34 168 Q30 198 28 226 L39 228 Q43 199 47 170 Q41 162 34 168 Z", onArm: true },
  { region: "core", d: "M88 123 L98 123 L98 139 L88 139 Z" },
  { region: "core", d: "M88 142 L98 142 L98 158 L88 158 Z" },
  { region: "core", d: "M88 161 L98 161 L98 177 L88 177 Z" },
  { region: "core", d: "M89 180 L98 180 L98 200 Q92 198 89 192 Z" },
  { region: "core", d: "M85 123 Q72 121 64 134 Q68 156 69 176 Q76 188 85 196 Z" },
  { region: "thighs", d: "M70 212 Q61 242 66 280 Q72 300 81 305 Q92 300 95 280 Q97 246 92 220 Q82 207 70 212 Z" },
  { d: "M78 306 Q74 314 78 320 Q86 324 92 318 Q94 310 88 305 Z" },
  { region: "calves", d: "M74 324 Q69 346 72 372 Q76 381 80 372 Q81 346 79 324 Z" },
  { region: "calves", d: "M88 322 Q95 342 93 364 Q89 370 86 360 Q85 340 85 322 Z" },
];

const BACK: Muscle[] = [
  { region: "back", d: "M100 54 L92 60 Q80 66 64 72 Q78 80 89 96 L100 122 Z" },
  { region: "shoulders", d: "M55 70 Q41 74 40 94 Q42 106 45 114 Q50 102 56 92 Q61 80 63 72 Z", onArm: true },
  { region: "back", d: "M88 100 Q73 96 59 104 Q61 132 69 160 Q82 160 95 148 Q92 124 88 100 Z" },
  { region: "back", d: "M93 150 Q90 174 92 194 L100 196 L100 150 Z" },
  { region: "arms", d: "M45 114 Q40 134 39 154 Q44 161 49 157 Q53 137 55 114 Q50 107 45 114 Z", onArm: true },
  { region: "forearms", d: "M34 168 Q30 198 28 226 L39 228 Q43 199 47 170 Q41 162 34 168 Z", onArm: true },
  { region: "hips", d: "M100 198 L71 196 Q61 210 65 234 Q80 246 99 238 Z" },
  { region: "hamstrings", d: "M67 242 Q63 272 72 302 Q84 306 94 298 Q97 270 96 244 Q82 248 67 242 Z" },
  { region: "calves", d: "M72 318 Q65 342 72 364 Q78 371 84 362 L84 320 Z" },
  { region: "calves", d: "M86 320 L86 362 Q92 370 95 357 Q98 336 92 318 Z" },
];

function Half({ muscles, build, highlight }: { muscles: Muscle[]; build: Build; highlight: BodyRegion[] }) {
  return (
    <>
      <path d={shape(BODY.neck, build)} className="figure-body" />
      <path d={shape(BODY.torso, build)} className="figure-body" />
      <path d={shape(BODY.leg, build)} className="figure-body" />
      <path d={shape(BODY.foot, build)} className="figure-body" />
      <path d={arm(ARM.limb, build)} className="figure-body" />
      <path d={arm(ARM.hand, build)} className="figure-body" />
      {muscles.map((muscle, index) => (
        <path key={index} d={muscle.onArm ? arm(muscle.d, build) : shape(muscle.d, build)}
          className={`figure-muscle ${muscle.region && highlight.includes(muscle.region) ? "on" : ""}`} />
      ))}
    </>
  );
}

function View({ side, build, highlight }: { side: "front" | "back"; build: Build; highlight: BodyRegion[] }) {
  const muscles = side === "front" ? FRONT : BACK;
  return (
    <>
      {build.hair && <path d={side === "front" ? "M83 26 Q84 6 100 5 Q116 6 117 26 Q112 14 100 14 Q88 14 83 26 Z" : "M83 30 Q82 6 100 5 Q118 6 117 30 Q112 46 100 47 Q88 46 83 30 Z"} className="figure-hair" />}
      {build.hair && <circle cx="100" cy={side === "front" ? 2 : 4} r="7" className="figure-hair" />}
      <Half muscles={muscles} build={build} highlight={highlight} />
      <g transform="translate(200 0) scale(-1 1)"><Half muscles={muscles} build={build} highlight={highlight} /></g>
      <ellipse cx="100" cy="30" rx="15.5" ry="20" className="figure-body" />
      {build.hair && side === "back" && <path d="M85 22 Q86 8 100 7 Q114 8 115 22 Q114 40 100 44 Q86 40 85 22 Z" className="figure-hair" />}
    </>
  );
}

interface BodyFigureProps {
  figure: FigureChoice;
  /** Muscle groups drawn in the accent colour, for example today's targets. */
  highlight?: BodyRegion[];
  /** Front only, or front and back side by side. */
  view?: "front" | "both";
  /** Read out for screen readers; leave empty when the figure sits beside a text list. */
  label?: string;
  className?: string;
}

export function BodyFigure({ figure, highlight = [], view = "front", label, className }: BodyFigureProps) {
  const build = BUILD[figure];
  return (
    <svg viewBox={view === "both" ? "-4 -8 418 444" : "-4 -8 208 444"} className={`body-figure ${view === "both" ? "both" : ""} ${className ?? ""}`}
      role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <View side="front" build={build} highlight={highlight} />
      {view === "both" && <g transform="translate(210 0)"><View side="back" build={build} highlight={highlight} /></g>}
    </svg>
  );
}
