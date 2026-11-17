"use client";

import { useEffect, useRef } from "react";

const TICK = 12;

/**
 * A ruler you slide sideways (like the weight screen in the references): the big number shows the value
 * under the centre line. Steps of `step`; a long tick and a label every whole `major`.
 */
export function RulerPicker({ min, max, step, major, value, onChange, unit, label }: {
  min: number; max: number; step: number; major: number; value: number; onChange: (value: number) => void; unit: string; label: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const settle = useRef(0);
  const count = Math.round((max - min) / step);
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const toIndex = (n: number) => Math.round((clamp(n) - min) / step);
  const round = (n: number) => Math.round(n / step) * step;

  useEffect(() => {
    if (track.current) track.current.scrollLeft = toIndex(value) * TICK;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- first show only
  }, []);

  function onScroll() {
    const element = track.current;
    if (!element) return;
    const next = Number(clamp(round(min + Math.round(element.scrollLeft / TICK) * step)).toFixed(2));
    if (next !== value) onChange(next);
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => navigator.vibrate?.(3), 80);
  }

  function nudge(delta: number) {
    const next = Number(clamp(value + delta * step).toFixed(2));
    onChange(next);
    track.current?.scrollTo({ left: toIndex(next) * TICK, behavior: "smooth" });
  }

  const decimals = step < 1 ? 1 : 0;
  return (
    <div className="ruler">
      <div className="ruler-value" aria-live="polite"><strong>{value.toFixed(decimals)}</strong><span>{unit}</span></div>
      <div className="ruler-frame">
        <span className="ruler-needle" aria-hidden="true" />
        <div
          ref={track}
          className="ruler-track"
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={`${value.toFixed(decimals)} ${unit}`}
          onScroll={onScroll}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight" || event.key === "ArrowUp") { event.preventDefault(); nudge(1); }
            if (event.key === "ArrowLeft" || event.key === "ArrowDown") { event.preventDefault(); nudge(-1); }
          }}
        >
          <div className="ruler-ticks">
            <span className="ruler-spacer" aria-hidden="true" />
            {Array.from({ length: count + 1 }, (_, i) => {
              const n = min + i * step;
              const isMajor = Math.abs(n / major - Math.round(n / major)) < 1e-6;
              return <span key={i} className={`ruler-tick ${isMajor ? "major" : ""}`}>{isMajor && <em>{Math.round(n)}</em>}</span>;
            })}
            <span className="ruler-spacer" aria-hidden="true" />
          </div>
        </div>
      </div>
      <div className="ruler-steps"><button type="button" className="icon-button" aria-label={`Less ${unit}`} onClick={() => nudge(-1)}>−</button><button type="button" className="icon-button" aria-label={`More ${unit}`} onClick={() => nudge(1)}>+</button></div>
    </div>
  );
}
