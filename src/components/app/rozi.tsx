"use client";

import Image from "next/image";
import { ENERGY_LABELS, energyMood, type RoziMood } from "@/lib/rozi";

/** Rozi, the RozFit mascot, in one of its moods. */
export function Rozi({ mood, size = 120, className = "", priority = false, eager = false }: { mood: RoziMood; size?: number; className?: string; priority?: boolean; eager?: boolean }) {
  // Off-screen pictures load as they scroll into view; above-the-fold ones use `priority`.
  return <Image src={`/rozi/${mood}.webp`} width={size} height={size} alt="" priority={priority} loading={priority ? undefined : eager ? "eager" : "lazy"} className={`rozi ${className}`} sizes={`${size}px`} />;
}

/** The check-in energy question: drag the slider and Rozi's face follows. */
export function RoziEnergy({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="rozi-energy">
      <span className="scale-label">How’s your energy today?</span>
      <div className="rozi-energy-face">
        {/* Every face is loaded up front so dragging never waits for a picture. */}
        {[1, 2, 3, 4, 5].map((level) => <Rozi key={level} mood={energyMood(level)} size={150} eager className={level === value ? "shown" : "hidden"} />)}
      </div>
      <strong className="rozi-energy-label" aria-live="polite">{ENERGY_LABELS[value - 1]}</strong>
      <input type="range" min={1} max={5} step={1} value={value} onChange={(event) => onChange(Number(event.target.value))}
        aria-label="Energy" aria-valuetext={`${value} out of 5, ${ENERGY_LABELS[value - 1]}`} className="rozi-energy-range" style={{ "--fill": `${((value - 1) / 4) * 100}%` } as React.CSSProperties} />
      <div className="scale-ends"><span>Drained</span><span>Great</span></div>
    </div>
  );
}
