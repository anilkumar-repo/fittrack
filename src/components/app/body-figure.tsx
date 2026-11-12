import type { BodyRegion, FigureChoice } from "@/lib/figure";

/** Half-widths and limb sizes for each figure, in drawing units (the figure is 120 wide, 264 tall). */
const SHAPES: Record<FigureChoice, { shoulder: number; waist: number; hip: number; arm: number; thigh: number; calf: number; neck: number; bun: boolean }> = {
  female: { shoulder: 17.5, waist: 11.5, hip: 23, arm: 8.5, thigh: 18.5, calf: 11, neck: 7.5, bun: true },
  male: { shoulder: 28, waist: 18.5, hip: 17.5, arm: 13, thigh: 16, calf: 12.5, neck: 12, bun: false },
  neutral: { shoulder: 22, waist: 15.5, hip: 19.5, arm: 10, thigh: 16.5, calf: 11.5, neck: 9, bun: false },
};

interface BodyFigureProps {
  figure: FigureChoice;
  /** Regions drawn in the accent colour, for example today's target muscles. */
  highlight?: BodyRegion[];
  /** Read out for screen readers; leave empty when the figure is decoration beside a text list. */
  label?: string;
  className?: string;
}

/** A simple front-view body made of separate regions, drawn for FitTrack. */
export function BodyFigure({ figure, highlight = [], label, className }: BodyFigureProps) {
  const s = SHAPES[figure];
  const c = 60;
  const on = (region: BodyRegion) => `figure-part ${highlight.includes(region) ? "on" : ""}`;
  const ribs = s.shoulder - (s.shoulder - s.waist) * 0.5;
  const shoulderX = s.shoulder + 4;
  const elbowX = s.shoulder + 9;
  const wristX = s.shoulder + 12;
  const legX = s.hip * 0.56;
  const limb = (x1: number, y1: number, x2: number, y2: number, width: number, cls: string) => (
    <>
      <line x1={c - x1} y1={y1} x2={c - x2} y2={y2} strokeWidth={width} className={`figure-limb ${cls}`} />
      <line x1={c + x1} y1={y1} x2={c + x2} y2={y2} strokeWidth={width} className={`figure-limb ${cls}`} />
    </>
  );
  return (
    <svg viewBox="0 0 120 264" className={`body-figure ${className ?? ""}`} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {s.bun && <circle cx={c} cy="5.5" r="5.5" className="figure-part" />}
      <ellipse cx={c} cy="21" rx="11" ry="12.5" className="figure-part" />
      <rect x={c - s.neck / 2} y="33" width={s.neck} height="10" rx="3" className="figure-part" />
      {limb(shoulderX, 56, elbowX, 96, s.arm, on("arms"))}
      {limb(elbowX + 1, 104, wristX, 138, s.arm - 2.5, on("forearms"))}
      <circle cx={c - wristX - 1} cy="147" r="5" className="figure-part" />
      <circle cx={c + wristX + 1} cy="147" r="5" className="figure-part" />
      <circle cx={c - shoulderX + 1} cy="52" r={s.arm * 0.78} className={on("shoulders")} />
      <circle cx={c + shoulderX - 1} cy="52" r={s.arm * 0.78} className={on("shoulders")} />
      <path d={`M${c - s.shoulder + 3} 46 H${c - 1.5} V78 H${c - ribs} Q${c - s.shoulder - 1} 62 ${c - s.shoulder + 3} 46 Z`} className={on("chest")} />
      <path d={`M${c + s.shoulder - 3} 46 H${c + 1.5} V78 H${c + ribs} Q${c + s.shoulder + 1} 62 ${c + s.shoulder - 3} 46 Z`} className={on("chest")} />
      <path d={`M${c - ribs} 81 H${c + ribs} Q${c + s.waist - 1} 94 ${c + s.waist} 108 H${c - s.waist} Q${c - s.waist + 1} 94 ${c - ribs} 81 Z`} className={on("core")} />
      <path d={`M${c - s.waist} 111 H${c + s.waist} Q${c + s.hip + 1} 118 ${c + s.hip} 130 L${c + 2} 138 H${c - 2} L${c - s.hip} 130 Q${c - s.hip - 1} 118 ${c - s.waist} 111 Z`} className={on("hips")} />
      {limb(legX, 142, legX - 1, 186, s.thigh, on("thighs"))}
      {limb(legX - 1.5, 200, legX - 2.5, 238, s.calf, on("calves"))}
      <ellipse cx={c - legX + 3.5} cy="254" rx="6" ry="4.5" className="figure-part" />
      <ellipse cx={c + legX - 3.5} cy="254" rx="6" ry="4.5" className="figure-part" />
    </svg>
  );
}
