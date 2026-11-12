"use client";

import { useState } from "react";

export interface ChartPoint {
  /** Short date or session label shown on the axis and in the tooltip. */
  label: string;
  value: number;
}

interface LineChartProps {
  points: ChartPoint[];
  formatValue: (value: number) => string;
  ariaLabel: string;
}

const WIDTH = 320;
const HEIGHT = 150;
const PAD = { top: 16, right: 16, bottom: 24, left: 16 };

/** One measure over time: a thin line with a marker per session. Exact values are in the table beside it. */
export function LineChart({ points, formatValue, ariaLabel }: LineChartProps) {
  const [active, setActive] = useState<number | null>(null);
  if (!points.length) return null;

  const values = points.map((point) => point.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || 1;
  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const x = (index: number) => PAD.left + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  const y = (value: number) => PAD.top + (high === low ? plotHeight / 2 : (1 - (value - low) / span) * plotHeight);
  const line = points.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(1)} ${y(point.value).toFixed(1)}`).join(" ");
  const last = points.length - 1;
  const shown = active ?? last;

  function pick(event: React.PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const position = ((event.clientX - box.left) / box.width) * WIDTH;
    let nearest = 0;
    for (let index = 1; index < points.length; index += 1) if (Math.abs(x(index) - position) < Math.abs(x(nearest) - position)) nearest = index;
    setActive(nearest);
  }

  return (
    <figure className="line-chart">
      <figcaption className="line-chart-readout" aria-live="off"><strong>{formatValue(points[shown].value)}</strong><span>{points[shown].label}{active === null && points.length > 1 ? " · latest" : ""}</span>{high !== low && <span className="line-chart-range">Lowest {formatValue(low)} · highest {formatValue(high)}</span>}</figcaption>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={ariaLabel} onPointerMove={pick} onPointerDown={pick} onPointerLeave={() => setActive(null)}>
        {high !== low && <>
          <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(high)} y2={y(high)} className="line-chart-grid" />
          <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(low)} y2={y(low)} className="line-chart-grid" />
        </>}
        {active !== null && <line x1={x(active)} x2={x(active)} y1={PAD.top - 6} y2={HEIGHT - PAD.bottom} className="line-chart-crosshair" />}
        {points.length > 1 && <path d={line} className="line-chart-line" />}
        {points.map((point, index) => <circle key={`${point.label}-${index}`} cx={x(index)} cy={y(point.value)} r={index === shown ? 5 : 4} className={`line-chart-dot ${index === shown ? "active" : ""}`} />)}
        <text x={PAD.left} y={HEIGHT - 6} className="line-chart-tick">{points[0].label}</text>
        {points.length > 1 && <text x={WIDTH - PAD.right} y={HEIGHT - 6} className="line-chart-tick" textAnchor="end">{points[last].label}</text>}
      </svg>
    </figure>
  );
}
