"use client";

import { useState } from "react";
import { WEEKDAY_LABELS } from "@/lib/dates";
import { hasSupabaseConfig } from "@/lib/supabase-browser";
import { EQUIPMENT_OPTIONS } from "@/lib/templates";
import type { EquipmentKey } from "@/lib/types";
import { useFitTrack } from "./fit-track-provider";
import { SignInForm } from "./sign-in-form";

const STEP_COUNT = 3;

/** First-run setup: name, training days, and equipment. Everything can be changed later in Settings. */
export function Welcome() {
  const { state, isDemo, completeOnboarding } = useFitTrack();
  const [step, setStep] = useState(1);
  const [showSignIn, setShowSignIn] = useState(false);
  const [name, setName] = useState(isDemo ? "" : state.profile.displayName);
  const [days, setDays] = useState<number[]>(state.profile.trainingDays);
  const [minutes, setMinutes] = useState(state.profile.preferredSessionMinutes);
  const [knowsEquipment, setKnowsEquipment] = useState(state.profile.equipmentAvailability === "verified");
  const [equipment, setEquipment] = useState<EquipmentKey[]>(state.profile.availableEquipment);
  const daysValid = days.length >= 2 && days.length <= 4;

  function toggleDay(day: number) {
    setDays((current) => current.includes(day) ? current.filter((value) => value !== day) : [...current, day].sort((a, b) => a - b));
  }

  function toggleEquipment(key: EquipmentKey) {
    setEquipment((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  }

  function finish() {
    completeOnboarding({
      displayName: name.trim() || state.profile.displayName,
      trainingDays: days,
      sessionsPerWeek: days.length,
      preferredSessionMinutes: minutes,
      equipmentAvailability: knowsEquipment ? "verified" : "unknown",
      availableEquipment: knowsEquipment ? equipment : [],
    });
  }

  return (
    <main className="welcome">
      <section className="welcome-card panel" aria-labelledby="welcome-title">
        <div className="welcome-brand"><span className="brand-mark">F</span><strong>fittrack</strong></div>
        <p className="welcome-progress" aria-label={`Step ${step} of ${STEP_COUNT}`}>{Array.from({ length: STEP_COUNT }, (_, index) => <span key={index} className={index < step ? "done" : ""} />)}</p>

        {step === 1 && <>
          <h1 id="welcome-title">Welcome. Let’s set up your plan.</h1>
          <p className="muted">Three quick questions, about a minute. You can change every answer later in Settings.</p>
          <label className="field-label">What should we call you?<input type="text" autoComplete="given-name" maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Your first name" /></label>
          <div className="welcome-actions"><span /><button className="button button-primary" disabled={!name.trim()} onClick={() => setStep(2)}>Next <span>→</span></button></div>
          {isDemo && hasSupabaseConfig() && <div className="welcome-sign-in">
            {showSignIn ? <SignInForm /> : <button type="button" className="text-button" onClick={() => setShowSignIn(true)}>I already have an account — sign in</button>}
          </div>}
        </>}

        {step === 2 && <>
          <h1 id="welcome-title">Which days suit you, {name.trim()}?</h1>
          <p className="muted">Pick 2 to 4 days. A rest day between sessions helps you recover.</p>
          <div className="training-days">{WEEKDAY_LABELS.map((label, day) => <button key={label} type="button" className={days.includes(day) ? "selected" : ""} aria-pressed={days.includes(day)} onClick={() => toggleDay(day)}>{label}</button>)}</div>
          {!daysValid && <p className="form-error" role="alert">Choose between 2 and 4 days.</p>}
          <label className="field-label">How long should a session be?<select value={minutes} onChange={(event) => setMinutes(Number(event.target.value))}><option value={30}>About 30 minutes</option><option value={40}>About 40 minutes</option><option value={50}>About 50 minutes</option></select></label>
          <div className="welcome-actions"><button className="text-button" onClick={() => setStep(1)}>← Back</button><button className="button button-primary" disabled={!daysValid} onClick={() => setStep(3)}>Next <span>→</span></button></div>
        </>}

        {step === 3 && <>
          <h1 id="welcome-title">What can you train with?</h1>
          <p className="muted">Your plan only uses equipment you tick. Not sure? Start with no equipment; every workout still works.</p>
          <div className="availability-buttons"><button type="button" className={!knowsEquipment ? "selected" : ""} aria-pressed={!knowsEquipment} onClick={() => setKnowsEquipment(false)}>No equipment / not sure</button><button type="button" className={knowsEquipment ? "selected" : ""} aria-pressed={knowsEquipment} onClick={() => setKnowsEquipment(true)}>I’ll tick what I have</button></div>
          {knowsEquipment && <div className="equipment-options">{EQUIPMENT_OPTIONS.map((item) => <label className="checkbox-row" key={item.id}><input type="checkbox" checked={equipment.includes(item.id)} onChange={() => toggleEquipment(item.id)} /><span><strong>{item.label}</strong></span></label>)}</div>}
          <div className="welcome-actions"><button className="text-button" onClick={() => setStep(2)}>← Back</button><button className="button button-primary" onClick={finish}>Start my plan <span>→</span></button></div>
        </>}
      </section>
    </main>
  );
}
