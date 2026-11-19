"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Check, Plus } from "lucide-react";
import { displayToKg, kgToDisplay, type WeightUnit } from "@/lib/logging";
import { platesPerSide, warmUpSets } from "@/lib/pro-tracking";
import { SheetGrip } from "@/components/ui/sheet-grip";
import { useScrollLock } from "./use-scroll-lock";

/** Plate colours follow the usual competition colours, so the picture matches what's on the gym floor. */
const PLATE_STYLE: Record<string, { color: string; height: number }> = {
  "25": { color: "#d64545", height: 96 }, "20": { color: "#3f7fd6", height: 96 }, "15": { color: "#e2b93b", height: 86 }, "10": { color: "#4caf7d", height: 76 },
  "5": { color: "#f2f2f2", height: 60 }, "2.5": { color: "#2b2f33", height: 50 }, "1.25": { color: "#b8bec4", height: 42 },
  // pounds
  "45": { color: "#3f7fd6", height: 96 }, "35": { color: "#e2b93b", height: 88 }, "lb25": { color: "#4caf7d", height: 78 }, "lb10": { color: "#f2f2f2", height: 60 }, "lb5": { color: "#2b2f33", height: 50 }, "lb2.5": { color: "#b8bec4", height: 42 },
};
const KG_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
const LB_PLATES = [45, 35, 25, 10, 5, 2.5];

/**
 * "Warm-up & plates" for one exercise: type a working weight to see which plates go on each side of the bar
 * (barbell moves only) and the warm-up sets (about 40 / 60 / 80 %). One button always confirms: it fills the working
 * weight into the sets not done yet, and adds the warm-ups when there are any. The keyboard's Go/Done confirms too.
 */
export function PlatesSheet({ exerciseName, barbell, unit, workKg, onConfirm, onClose }: {
  exerciseName: string; barbell: boolean; unit: WeightUnit; workKg: number | null;
  /** Saves the working weight (kg) into the working sets not done yet, and adds `warmUps` (may be empty) on top. */
  onConfirm: (workKg: number, warmUps: Array<{ loadKg: number; reps: number }>) => void;
  onClose: () => void;
}) {
  useScrollLock();
  const [target, setTarget] = useState(workKg ? String(kgToDisplay(workKg, unit)) : "");
  const [bar, setBar] = useState(unit === "lb" ? 45 : 20);
  const value = Number(target) || 0;
  const plates = platesPerSide(value, bar, unit === "lb" ? LB_PLATES : KG_PLATES);
  const warm = warmUpSets(displayToKg(value, unit), barbell ? displayToKg(bar, unit) : 0);
  const belowBar = barbell && value > 0 && value < bar;
  const canConfirm = value > 0 && value <= 1000 && !belowBar;
  function confirm() {
    if (!canConfirm) return;
    onConfirm(displayToKg(value, unit), warm);
    onClose();
  }
  const style = (plate: number) => PLATE_STYLE[unit === "lb" && plate <= 25 ? `lb${plate}` : String(plate)] ?? { color: "#999", height: 50 };

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`Warm-up and plates for ${exerciseName}`} onClick={onClose}>
      <section className="modal plates-sheet" onClick={(event) => event.stopPropagation()}>
        <SheetGrip onClose={onClose} />
        <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>×</button>
        <span className="onb-kicker">Warm-up & plates</span>
        <h2>{exerciseName}</h2>
        <form className="plates-target-form" onSubmit={(event) => { event.preventDefault(); confirm(); }}>
          <label className="plates-target">Working weight
            <span className="unit-input"><input type="number" inputMode="decimal" min="0" step="0.5" enterKeyHint="done" value={target} placeholder="e.g. 60" onChange={(event) => setTarget(event.target.value)} /><em>{unit}</em></span>
          </label>
        </form>

        {barbell && <>
          <div className="plates-bar-choice segmented" role="radiogroup" aria-label="Bar weight">
            {(unit === "lb" ? [45, 35, 25] : [20, 15, 10]).map((weight) => <button key={weight} type="button" role="radio" aria-checked={bar === weight} className={bar === weight ? "selected" : ""} onClick={() => setBar(weight)}>{weight} {unit} bar</button>)}
          </div>
          <div className="plates-visual" aria-label={plates.perSide.length ? `Each side: ${plates.perSide.join(", ")} ${unit}` : "Just the bar"}>
            <span className="plates-sleeve" />
            {plates.perSide.map((plate, index) => <span key={index} className="plate" style={{ background: style(plate).color, height: style(plate).height }}><small>{plate}</small></span>)}
            <span className="plates-collar" />
            <span className="plates-shaft" />
          </div>
          <p className="plates-line">{belowBar ? `${value} ${unit} is lighter than the ${bar} ${unit} bar on its own — pick a lighter bar above, or check the weight.` : value <= bar ? `Just the ${bar} ${unit} bar.` : <>Each side: <strong>{plates.perSide.join(" + ")} {unit}</strong>{plates.shortKg > 0 ? ` (${plates.shortKg} ${unit} short of ${value})` : ""}</>}</p>
        </>}

        <h3 className="train-subhead">Warm-up sets</h3>
        {warm.length && !belowBar
          ? <ol className="warm-list">{warm.map((set) => <li key={set.loadKg}><b>W</b><span>{kgToDisplay(set.loadKg, unit)} {unit} × {set.reps}</span><small>{set.percent}%</small></li>)}</ol>
          : <p className="card-note">{!value ? "Type a working weight to see warm-up sets." : belowBar ? "Warm-ups appear once the weight is at least the bar." : `${value} ${unit} is light enough to start with — no warm-up sets needed.`}</p>}
        <button type="button" className="button button-primary full-width" disabled={!canConfirm} onClick={confirm}>
          {warm.length && canConfirm ? <><Plus aria-hidden="true" /> Use {value} {unit} + add {warm.length} warm-up sets</> : <><Check aria-hidden="true" /> {canConfirm ? `Use ${value} ${unit} for my sets` : "Use this weight"}</>}
        </button>
        <p className="card-note">Warm-up sets show as <b>W</b> and never count toward your records.</p>
      </section>
    </div>,
    document.body,
  );
}
