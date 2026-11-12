import { FLOOR_Y, getExerciseIllustration, poseJoints, type Pose, type Prop } from "@/lib/exercise-media";

function PropShape({ prop, joints, top }: { prop: Prop; joints: ReturnType<typeof poseJoints>; top: number }) {
  switch (prop.kind) {
    case "rect": return <rect x={prop.x} y={prop.y} width={prop.w} height={prop.h} rx="1.5" className="illo-prop-fill" />;
    case "line": return <line x1={prop.x1} y1={prop.y1} x2={prop.x2} y2={prop.y2} className="illo-prop-line" />;
    case "wall": return <line x1={prop.x} y1={top + 4} x2={prop.x} y2={FLOOR_Y} className="illo-prop-line" />;
    case "under": {
      const [x, y] = joints[prop.joint];
      const top = y + (prop.dy ?? 1.5);
      return <rect x={x + (prop.dx ?? 0) - prop.w / 2} y={top} width={prop.w} height={Math.max(2, FLOOR_Y - top)} rx="1.5" className="illo-prop-fill" />;
    }
    case "weight": { const [x, y] = joints[prop.joint]; return <circle cx={x} cy={y} r="3.6" className="illo-weight" />; }
    case "plate": { const [x, y] = joints[prop.joint]; return <line x1={x + 2.5} y1={y - 9} x2={x + 2.5} y2={y + 9} className="illo-prop-line" />; }
    case "cable": {
      const [x, y] = joints[prop.joint];
      return prop.to === "up" ? <line x1={x} y1={y} x2={x} y2={top + 2} className="illo-cable" /> : <line x1={x} y1={y} x2="98" y2={y} className="illo-cable" />;
    }
  }
}

function Figure({ pose, top }: { pose: Pose; top: number }) {
  const j = poseJoints(pose);
  const path = (...points: Array<[number, number]>) => points.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const twoLegs = pose.thigh2 !== undefined;
  const twoArms = pose.upper2 !== undefined;
  return (
    <>
      <line x1="2" y1={FLOOR_Y + 1.5} x2="98" y2={FLOOR_Y + 1.5} className="illo-floor" />
      {(pose.props ?? []).filter((prop) => prop.kind !== "weight").map((prop, index) => <PropShape key={index} prop={prop} joints={j} top={top} />)}
      {twoLegs && <path d={path(j.hip, j.knee2, j.foot2)} className="illo-limb illo-far" />}
      {twoArms && <path d={path(j.shoulder, j.elbow2, j.hand2)} className="illo-limb illo-far" />}
      <path d={path(j.foot, j.knee, j.hip, j.shoulder)} className="illo-limb" />
      <path d={path(j.shoulder, j.elbow, j.hand)} className="illo-limb" />
      <circle cx={j.head[0]} cy={j.head[1]} r="5.2" className="illo-head" />
      {(pose.props ?? []).filter((prop) => prop.kind === "weight").map((prop, index) => <PropShape key={index} prop={prop} joints={j} top={top} />)}
    </>
  );
}

/** A start-and-finish position guide for an exercise. Renders nothing if the exercise has no drawing. */
export function ExerciseIllustration({ exerciseId, name, compact = false }: { exerciseId: string; name: string; compact?: boolean }) {
  const illustration = getExerciseIllustration(exerciseId);
  if (!illustration) return null;
  const { start, finish } = illustration;
  // Trim empty space above low positions (lying down, seated) so the figures stay large.
  const highest = Math.min(...[start, finish].flatMap((pose) => pose ? Object.values(poseJoints(pose)).map(([, y]) => y) : []));
  const top = Math.max(0, Math.floor(highest - 12));
  const bottom = compact ? 96 : 108;
  const arrowY = Math.round((top + FLOOR_Y) / 2);
  return (
    <svg className={`exercise-illustration ${compact ? "compact" : ""}`} viewBox={`0 ${top} 224 ${bottom - top}`} role="img"
      aria-label={finish ? `${name}: start and finish positions` : `${name}: hold position`}>
      <g transform={finish ? undefined : "translate(62 0)"}><Figure pose={start} top={top} /></g>
      {finish && <>
        <path d={`M104 ${arrowY} H118 M113 ${arrowY - 5} L119 ${arrowY} L113 ${arrowY + 5}`} className="illo-arrow" />
        <g transform="translate(124 0)"><Figure pose={finish} top={top} /></g>
      </>}
      {!compact && <>
        <text x={finish ? 50 : 112} y="105" className="illo-label">{finish ? "Start" : "Hold this position"}</text>
        {finish && <text x="174" y="105" className="illo-label">Finish</text>}
      </>}
    </svg>
  );
}
