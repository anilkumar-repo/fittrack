"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { BodyFields, bodyDraftValid, draftStats, draftWhy, EMPTY_BODY_DRAFT, WhyFields, whyDraftValid, type BodyDraft } from "./body-form";
import { saveCloudBodyWeightEntry } from "@/lib/supabase-repository";
import { useFitTrack } from "./fit-track-provider";
import { Rozi } from "./rozi";

/**
 * People who finished Get started before body stats existed are asked once for height, weight, age and
 * their "why". It is required (no close button): the plan, BMI targets and reminders depend on it.
 */
export function ProfileGate() {
  const { state, getState, updateState, updateProfile, browserClient, currentDate, setWeightUnit } = useFitTrack();
  const profile = state.profile;
  const missing = !profile.heightCm || !profile.birthYear || !profile.why;
  const [draft, setDraft] = useState<BodyDraft>(EMPTY_BODY_DRAFT);
  const [step, setStep] = useState<"body" | "why">("body");
  const [busy, setBusy] = useState(false);
  if (!state.onboarded || !missing) return null;

  async function save() {
    const stats = draftStats(draft);
    if (!stats.heightCm || !stats.weightKg || !stats.age) return;
    setBusy(true);
    if (draft.unit === "us") setWeightUnit("lb");
    const entry = { id: `weight-${profile.id}-${currentDate}`, measuredOn: currentDate, weightKg: stats.weightKg };
    const latest = getState();
    updateState({ ...latest, bodyWeightEntries: [...latest.bodyWeightEntries.filter((item) => item.measuredOn !== currentDate), entry].sort((a, b) => a.measuredOn.localeCompare(b.measuredOn)) });
    if (latest.mode === "supabase" && browserClient) await saveCloudBodyWeightEntry(browserClient, profile.id, entry).catch(() => undefined);
    updateProfile({ heightCm: stats.heightCm, birthYear: Number(currentDate.slice(0, 4)) - stats.age, sex: stats.sex, why: draftWhy(draft) });
    setBusy(false);
  }

  return (
    <div className="gate-backdrop" role="dialog" aria-modal="true" aria-labelledby="gate-title">
      <section className="gate-card">
        <Rozi mood="hello" size={84} eager />
        {step === "body" ? <>
          <h2 id="gate-title">Quick update for your plan</h2>
          <p>RozFit now tailors workouts to your body. Add your height, weight and age — it takes 20 seconds.</p>
          <BodyFields draft={draft} onChange={setDraft} />
          <button type="button" className="button button-primary full-width" disabled={!bodyDraftValid(draft)} onClick={() => setStep("why")}>Continue <ArrowRight aria-hidden="true" /></button>
        </> : <>
          <h2 id="gate-title">Why are you training?</h2>
          <p>Pick up to 3. On tough days, Rozi will remind you why you began.</p>
          <WhyFields draft={draft} onChange={setDraft} />
          <button type="button" className="button button-primary full-width" disabled={!whyDraftValid(draft) || busy} onClick={() => void save()}>{busy ? "Saving…" : "Save"}</button>
          <button type="button" className="text-button" onClick={() => setStep("body")}>Back</button>
        </>}
      </section>
    </div>
  );
}
