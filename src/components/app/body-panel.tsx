"use client";

import { useState } from "react";
import { bodyPlan, profileBodyStats } from "@/lib/body";
import { formatWeight } from "@/lib/logging";
import { upsertBodyWeightEntry } from "@/lib/progress";
import { saveCloudBodyWeightEntry } from "@/lib/supabase-repository";
import { BmiCard, BodyFields, bodyDraftValid, draftStats, draftWhy, WhyFields, whyDraftValid, type BodyDraft } from "./body-form";
import { useFitTrack } from "./fit-track-provider";
import { needsBirthDate, validBirthDate } from "@/lib/discover";

/** Progress: BMI, healthy range, target, and change since the first weight. */
export function BodyPanel() {
  const { state, currentDate, weightUnit } = useFitTrack();
  const stats = profileBodyStats(state.profile, state.bodyWeightEntries, currentDate);
  if (!stats) return null;
  const plan = bodyPlan(stats);
  const sorted = [...state.bodyWeightEntries].sort((a, b) => a.measuredOn.localeCompare(b.measuredOn));
  const first = sorted[0];
  const change = first && sorted.length > 1 ? Math.round((stats.weightKg - first.weightKg) * 10) / 10 : null;
  return (
    <article className="panel body-panel">
      <div className="panel-title"><h3>Body &amp; BMI</h3><span className="panel-count">Now {formatWeight(stats.weightKg, weightUnit)}{change !== null ? ` · ${change > 0 ? "+" : ""}${formatWeight(change, weightUnit)} since you started` : ""}</span></div>
      <BmiCard plan={plan} />
    </article>
  );
}

/** Settings: see and edit height, weight, age, sex and "why". */
export function BodySettings() {
  const { state, getState, updateState, updateProfile, browserClient, currentDate, weightUnit } = useFitTrack();
  const profile = state.profile;
  const latest = [...state.bodyWeightEntries].sort((a, b) => a.measuredOn.localeCompare(b.measuredOn)).at(-1);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<BodyDraft | null>(null);
  const [busy, setBusy] = useState(false);

  function open() {
    const us = weightUnit === "lb";
    const inches = profile.heightCm ? Math.round(profile.heightCm / 2.54) : 0;
    const age = profile.birthYear ? Number(currentDate.slice(0, 4)) - profile.birthYear : "";
    const parts = (profile.why ?? "").split(" — ");
    setDraft({
      unit: us ? "us" : "metric",
      heightCm: profile.heightCm ? String(profile.heightCm) : "",
      feet: inches ? String(Math.floor(inches / 12)) : "", inches: inches ? String(inches % 12) : "",
      weight: latest ? String(us ? Math.round(latest.weightKg / 0.45359237) : latest.weightKg) : "",
      age: String(age), sex: profile.sex ?? "",
      whyChips: parts[0] ? parts[0].split(", ").filter(Boolean) : [], whyText: parts.slice(1).join(" — "),
    });
    setEditing(true);
  }

  async function save() {
    if (!draft) return;
    const stats = draftStats(draft);
    if (!stats.heightCm || !stats.weightKg || !stats.age) return;
    setBusy(true);
    if (!latest || Math.abs(latest.weightKg - stats.weightKg) >= 0.1) {
      let entry = { id: `weight-${profile.id}-${currentDate}`, measuredOn: currentDate, weightKg: stats.weightKg };
      if (state.mode === "supabase" && browserClient) entry = await saveCloudBodyWeightEntry(browserClient, profile.id, entry).catch(() => entry);
      const current = getState();
      updateState({ ...current, bodyWeightEntries: upsertBodyWeightEntry(current.bodyWeightEntries, entry) });
    }
    // With a full date of birth saved, the birth year always follows it (the database does the same).
    const birthYear = profile.birthDate ? Number(profile.birthDate.slice(0, 4)) : Number(currentDate.slice(0, 4)) - stats.age;
    updateProfile({ heightCm: stats.heightCm, birthYear, sex: stats.sex, why: draftWhy(draft) });
    setBusy(false);
    setEditing(false);
  }

  const age = profile.birthYear ? Number(currentDate.slice(0, 4)) - profile.birthYear : null;
  return (
    <div className="settings-field body-settings"><span>Your body</span>
      {editing && draft ? <>
        <BodyFields draft={draft} onChange={(update) => setDraft((current) => current ? update(current) : current)} />
        <span>Why you started</span>
        <WhyFields draft={draft} onChange={(update) => setDraft((current) => current ? update(current) : current)} />
        <div className="account-card-actions">
          <button type="button" className="button button-primary" disabled={busy || !bodyDraftValid(draft) || !whyDraftValid(draft)} onClick={() => void save()}>{busy ? "Saving…" : "Save"}</button>
          <button type="button" className="button button-subtle" onClick={() => setEditing(false)}>Cancel</button>
        </div>
      </> : <>
        <p className="body-summary">
          {profile.heightCm ? `${weightUnit === "lb" ? `${Math.floor(profile.heightCm / 2.54 / 12)}′${Math.round(profile.heightCm / 2.54) % 12}″` : `${profile.heightCm} cm`}` : "Height not set"}
          {latest ? ` · ${formatWeight(latest.weightKg, weightUnit)}` : ""}{age ? ` · ${age} years` : ""}
        </p>
        {profile.why && <p className="body-why">“{profile.why}”</p>}
        <button type="button" className="button button-subtle" onClick={open}>Edit body and why</button>
      </>}
    </div>
  );
}

/**
 * Settings: optional full date of birth. Only it can confirm 18+ for someone whose birth year is exactly 18 years ago
 * (Rozi AI and "Let people find me" are for adults). Saving it also sets the birth year.
 */
export function BirthDateSetting() {
  const { state, updateProfile, currentDate } = useFitTrack();
  const saved = state.profile.birthDate ?? "";
  const [value, setValue] = useState(saved);
  const valid = validBirthDate(value);
  const needed = needsBirthDate(state.profile, currentDate);
  return (
    <label className="settings-field birth-date-field">
      <span>Date of birth <small>(optional)</small></span>
      <small className="field-hint">{needed ? "Your age alone can’t confirm you’re 18 yet — add your date of birth to use Rozi AI and Find friends." : "Only used to confirm you’re 18+ for Rozi AI and Find friends. Never shown to anyone."}</small>
      <div className="birth-date-row">
        <input type="date" value={value} min="1900-01-01" max={currentDate} onChange={(event) => setValue(event.target.value)} aria-label="Date of birth" />
        <button type="button" className="button button-subtle" disabled={!valid || value === saved || value > currentDate}
          onClick={() => { if (valid && valid <= currentDate) updateProfile({ birthDate: valid, birthYear: Number(valid.slice(0, 4)) }); }}>Save</button>
      </div>
    </label>
  );
}
