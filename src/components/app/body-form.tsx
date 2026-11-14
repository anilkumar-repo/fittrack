"use client";

import { BMI_BAND_LABEL, bodyPlan, MIN_AGE, validBodyStats, type BodySex, type BodyStats } from "@/lib/body";
import { WHY_OPTIONS } from "@/lib/wellness";

/** What the person typed, in their chosen units. */
export interface BodyDraft {
  unit: "metric" | "us";
  heightCm: string;
  feet: string;
  inches: string;
  weight: string;
  age: string;
  sex: BodySex | "";
  whyChips: string[];
  whyText: string;
}

export const EMPTY_BODY_DRAFT: BodyDraft = { unit: "metric", heightCm: "", feet: "", inches: "", weight: "", age: "", sex: "", whyChips: [], whyText: "" };

export function draftStats(draft: BodyDraft): Partial<BodyStats> {
  const heightCm = draft.unit === "metric" ? Number(draft.heightCm) : (Number(draft.feet) * 12 + Number(draft.inches || 0)) * 2.54;
  const weightKg = draft.unit === "metric" ? Number(draft.weight) : Number(draft.weight) * 0.45359237;
  return {
    heightCm: heightCm ? Math.round(heightCm * 10) / 10 : undefined,
    weightKg: weightKg ? Math.round(weightKg * 10) / 10 : undefined,
    age: Number(draft.age) || undefined,
    sex: draft.sex || undefined,
  };
}

export function draftWhy(draft: BodyDraft): string {
  const text = draft.whyText.trim();
  return [draft.whyChips.join(", "), text].filter(Boolean).join(" — ").slice(0, 200);
}

export function bodyDraftValid(draft: BodyDraft): boolean {
  return validBodyStats(draftStats(draft));
}

export function whyDraftValid(draft: BodyDraft): boolean {
  return draft.whyChips.length > 0 || draft.whyText.trim().length >= 3;
}

/** Height, weight, age (and optional sex), with the BMI result shown as soon as the numbers make sense. */
/** Changes always build on the latest draft, so quick taps never undo each other. */
export type DraftUpdate = (update: (draft: BodyDraft) => BodyDraft) => void;

export function BodyFields({ draft, onChange }: { draft: BodyDraft; onChange: DraftUpdate }) {
  const set = (patch: Partial<BodyDraft>) => onChange((current) => ({ ...current, ...patch }));
  const stats = draftStats(draft);
  const plan = validBodyStats(stats) ? bodyPlan(stats) : null;
  const ageNumber = Number(draft.age);
  return (
    <div className="body-form">
      <div className="segmented body-units" role="radiogroup" aria-label="Units">
        <button type="button" role="radio" aria-checked={draft.unit === "metric"} className={draft.unit === "metric" ? "selected" : ""} onClick={() => set({ unit: "metric" })}>cm · kg</button>
        <button type="button" role="radio" aria-checked={draft.unit === "us"} className={draft.unit === "us" ? "selected" : ""} onClick={() => set({ unit: "us" })}>ft · lb</button>
      </div>
      <div className="body-grid">
        {draft.unit === "metric"
          ? <label>Height<span className="unit-input"><input inputMode="decimal" type="number" min={100} max={250} placeholder="165" value={draft.heightCm} onChange={(event) => set({ heightCm: event.target.value })} /><em>cm</em></span></label>
          : <label>Height<span className="unit-pair"><span className="unit-input"><input inputMode="numeric" type="number" min={3} max={8} placeholder="5" value={draft.feet} onChange={(event) => set({ feet: event.target.value })} /><em>ft</em></span><span className="unit-input"><input inputMode="numeric" type="number" min={0} max={11} placeholder="6" value={draft.inches} onChange={(event) => set({ inches: event.target.value })} /><em>in</em></span></span></label>}
        <label>Weight<span className="unit-input"><input inputMode="decimal" type="number" min={25} max={800} placeholder={draft.unit === "metric" ? "62" : "137"} value={draft.weight} onChange={(event) => set({ weight: event.target.value })} /><em>{draft.unit === "metric" ? "kg" : "lb"}</em></span></label>
        <label>Age<span className="unit-input"><input inputMode="numeric" type="number" min={MIN_AGE} max={100} placeholder="28" value={draft.age} onChange={(event) => set({ age: event.target.value })} /><em>years</em></span></label>
      </div>
      <div className="body-sex">
        <span>For realistic muscle targets (optional)</span>
        <div className="segmented" role="radiogroup" aria-label="Sex">
          {(["female", "male", "other"] as const).map((value) => <button key={value} type="button" role="radio" aria-checked={draft.sex === value} className={draft.sex === value ? "selected" : ""} onClick={() => onChange((current) => ({ ...current, sex: current.sex === value ? "" : value }))}>{value === "other" ? "Prefer not to say" : value[0].toUpperCase() + value.slice(1)}</button>)}
        </div>
      </div>
      {draft.age && ageNumber > 0 && ageNumber < MIN_AGE && <p className="body-warn" role="status">RozFit is for ages {MIN_AGE} and up.</p>}
      {plan && <BmiCard plan={plan} />}
    </div>
  );
}

/** The BMI result: number, band, healthy range and what it means (lose fat / gain muscle / keep and tone). */
export function BmiCard({ plan }: { plan: ReturnType<typeof bodyPlan> }) {
  const position = Math.min(100, Math.max(0, ((plan.bmi - 15) / (40 - 15)) * 100));
  return (
    <article className={`bmi-card ${plan.band}`} aria-live="polite">
      <div className="bmi-top">
        <div><span className="bmi-label">Your BMI</span><strong className="bmi-value">{plan.bmi}</strong></div>
        <span className="bmi-band">{BMI_BAND_LABEL[plan.band]}</span>
      </div>
      <div className="bmi-scale" aria-hidden="true"><span className="bmi-marker" style={{ left: `${position}%` }} /></div>
      <div className="bmi-scale-labels" aria-hidden="true"><span>18.5</span><span>25</span><span>30</span></div>
      <strong className="bmi-headline">{plan.headline}</strong>
      <p>{plan.detail}</p>
      <small>BMI is a quick guide, not a diagnosis. It can read high for very muscular people.</small>
    </article>
  );
}

/** Why are you starting? Choices plus your own words; Rozi quotes it when you need a push. */
export function WhyFields({ draft, onChange }: { draft: BodyDraft; onChange: DraftUpdate }) {
  const toggle = (chip: string) => onChange((current) => ({ ...current, whyChips: current.whyChips.includes(chip) ? current.whyChips.filter((item) => item !== chip) : [...current.whyChips, chip].slice(0, 3) }));
  return (
    <div className="why-form">
      <div className="onb-chips" role="group" aria-label="Reasons">{WHY_OPTIONS.map((chip) => <button key={chip} type="button" className={draft.whyChips.includes(chip) ? "selected" : ""} aria-pressed={draft.whyChips.includes(chip)} onClick={() => toggle(chip)}>{chip}</button>)}</div>
      <label className="why-text">In your own words (optional)
        <textarea rows={2} maxLength={140} placeholder="e.g. I want to play football with my son without getting tired" value={draft.whyText} onChange={(event) => { const whyText = event.target.value; onChange((current) => ({ ...current, whyText })); }} />
      </label>
    </div>
  );
}
