"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { RotateCw } from "lucide-react";
import type { BodyRegion, FigureChoice } from "@/lib/figure";
import { REGION_LABELS } from "@/lib/figure";
import { sidePicture, startingSide } from "@/lib/muscle-images";
import { BodyFigure } from "./body-figure";

/**
 * The anatomy figure for one muscle group. Tap it or drag sideways to turn the body around
 * between the front and back views.
 */
export function TurnableFigure({ figure, region }: { figure: FigureChoice; region?: BodyRegion }) {
  const front = sidePicture(figure, "front", region);
  const back = sidePicture(figure, "back", region);
  const [angle, setAngle] = useState(startingSide(region) === "back" ? 180 : 0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; angle: number; moved: boolean } | null>(null);
  const showingBack = Math.round(angle / 180) % 2 !== 0;

  if (!front || !back) return <BodyFigure figure={figure} highlight={region ? [region] : []} view="both" />;

  const snap = (value: number) => Math.round(value / 180) * 180;
  const label = region ? REGION_LABELS[region] : "Body";

  return (
    <div className="turn">
      <button type="button" className="turn-stage" aria-label={`${label}, ${showingBack ? "back" : "front"} view. Turn the body around`}
        onPointerDown={(event) => { drag.current = { x: event.clientX, angle, moved: false }; setDragging(true); event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          const dx = event.clientX - drag.current.x;
          if (Math.abs(dx) > 6) drag.current.moved = true;
          if (drag.current.moved) setAngle(drag.current.angle + dx * 0.9);
        }}
        onPointerUp={() => {
          const state = drag.current;
          drag.current = null;
          setDragging(false);
          if (!state) return;
          setAngle(state.moved ? snap(angle) : state.angle + 180);
        }}
        onPointerCancel={() => { drag.current = null; setDragging(false); setAngle(snap(angle)); }}
        onKeyDown={(event) => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); setAngle((value) => snap(value) + (event.key === "ArrowRight" ? 180 : -180)); } }}>
        <span className={`turn-body ${dragging ? "dragging" : ""}`} style={{ transform: `rotateY(${angle}deg)` }}>
          <span className="turn-face"><Image src={front.src} width={front.width} height={front.height} alt="" loading="eager" sizes="200px" /></span>
          <span className="turn-face turn-back"><Image src={back.src} width={back.width} height={back.height} alt="" loading="eager" sizes="200px" /></span>
        </span>
      </button>
      <p className="turn-hint"><RotateCw aria-hidden="true" /> {showingBack ? "Back view" : "Front view"} · tap or drag to turn</p>
    </div>
  );
}
