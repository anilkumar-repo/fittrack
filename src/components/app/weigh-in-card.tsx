"use client";

import { useState } from "react";
import { Scale } from "lucide-react";
import { weighInDue, weighInTips } from "@/lib/body";
import { goalOf } from "@/lib/program";
import { displayToKg } from "@/lib/logging";
import { upsertBodyWeightEntry } from "@/lib/progress";
import { saveCloudBodyWeightEntry } from "@/lib/supabase-repository";
import { useFitTrack } from "./fit-track-provider";
import { Rozi } from "./rozi";

const TIPS_KEY = "rozfit-weighin-tips";

function daysBetween(later: string, earlier: string): number {
  return Math.round((Date.parse(`${later}T12:00:00Z`) - Date.parse(`${earlier}T12:00:00Z`)) / 86_400_000);
}

/**
 * Home: once a month (30 days after the last weight) Rozi asks for a weigh-in, then gives tips for the month
 * ahead based on the change and the person's goal. The tips stay on Home for the rest of that day.
 */
export function WeighInCard() {
  const { state, getState, updateState, browserClient, currentDate, weightUnit } = useFitTrack();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tips, setTips] = useState<string[] | null>(() => {
    try { const raw = window.localStorage.getItem(TIPS_KEY); const saved = raw ? JSON.parse(raw) as { date: string; tips: string[] } : null; return saved?.date === currentDate ? saved.tips : null; } catch { return null; }
  });
  const entries = state.bodyWeightEntries;
  const due = weighInDue(entries, currentDate);
  if (!state.profile.heightCm) return null;
  if (!due && !tips) return null;

  function dismiss() {
    try { window.localStorage.removeItem(TIPS_KEY); } catch { /* hides for now */ }
    setTips(null);
  }

  async function save() {
    const weightKg = displayToKg(Number(value), weightUnit);
    if (!(weightKg >= 25 && weightKg <= 350)) { setError("Enter your weight."); return; }
    setBusy(true);
    setError("");
    const previous = [...entries].sort((a, b) => a.measuredOn.localeCompare(b.measuredOn)).at(-1) ?? null;
    let entry = { id: `weight-${state.profile.id}-${currentDate}`, measuredOn: currentDate, weightKg: Math.round(weightKg * 10) / 10 };
    try {
      if (state.mode === "supabase" && browserClient) entry = await saveCloudBodyWeightEntry(browserClient, state.profile.id, entry);
      const latest = getState();
      updateState({ ...latest, bodyWeightEntries: upsertBodyWeightEntry(latest.bodyWeightEntries, entry) });
      const next = weighInTips(previous?.weightKg ?? null, entry.weightKg, previous ? daysBetween(currentDate, previous.measuredOn) : 0, goalOf(state.profile), state.profile.heightCm);
      setTips(next);
      try { window.localStorage.setItem(TIPS_KEY, JSON.stringify({ date: currentDate, tips: next })); } catch { /* shown until the page closes */ }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="weigh-card panel" id="weigh-in">
      <Rozi mood={tips ? "cheer" : "morning"} size={70} />
      <div className="weigh-copy">
        <span className="water-tag"><Scale aria-hidden="true" /> Monthly check-in</span>
        {tips ? <>
          <strong>Your tips for this month</strong>
          <ul>{tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
          <button type="button" className="text-button" onClick={dismiss}>Got it</button>
        </> : <>
          <strong>Time to weigh in</strong>
          <small>Best in the morning, before breakfast. Rozi will suggest what to adjust.</small>
          <form className="weigh-form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
            <span className="unit-input"><input type="number" inputMode="decimal" step="0.1" placeholder={weightUnit === "lb" ? "150" : "68"} value={value} onChange={(event) => setValue(event.target.value)} aria-label={`Weight in ${weightUnit}`} /><em>{weightUnit}</em></span>
            <button type="submit" className="button button-primary" disabled={busy || !value}>{busy ? "Saving…" : "Save"}</button>
          </form>
          {error && <small className="body-warn">{error}</small>}
        </>}
      </div>
    </article>
  );
}
