"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { WEEKDAY_LABELS } from "@/lib/dates";
import { FIGURE_OPTIONS, type FigureChoice } from "@/lib/figure";
import { hasSupabaseConfig } from "@/lib/supabase-browser";
import { EQUIPMENT_OPTIONS } from "@/lib/templates";
import type { EquipmentKey } from "@/lib/types";
import { MusclePicture } from "./muscle-picture";
import { BrandMark } from "./brand-mark";
import { useFitTrack } from "./fit-track-provider";
import { SignInForm } from "./sign-in-form";

type Step = "hero" | "name" | "figure" | "days" | "length" | "equipment";
const QUESTIONS: Step[] = ["name", "figure", "days", "length", "equipment"];
const LENGTHS = [
  { minutes: 30, title: "About 30 minutes", note: "Short and focused" },
  { minutes: 40, title: "About 40 minutes", note: "A steady, unhurried session" },
  { minutes: 50, title: "About 50 minutes", note: "More time for each movement" },
];

/** First-run setup, one question per screen. Every answer can be changed later in Settings. */
export function Welcome() {
  const { state, isDemo, completeOnboarding, figure, setFigure } = useFitTrack();
  const [step, setStep] = useState<Step>("hero");
  const [showSignIn, setShowSignIn] = useState(false);
  const [name, setName] = useState(isDemo ? "" : state.profile.displayName);
  const [days, setDays] = useState<number[]>(state.profile.trainingDays);
  const [minutes, setMinutes] = useState(state.profile.preferredSessionMinutes);
  const [knowsEquipment, setKnowsEquipment] = useState(state.profile.equipmentAvailability === "verified");
  const [equipment, setEquipment] = useState<EquipmentKey[]>(state.profile.availableEquipment);
  const position = QUESTIONS.indexOf(step);
  const daysValid = days.length >= 2 && days.length <= 4;
  const canContinue = step === "name" ? Boolean(name.trim()) : step === "days" ? daysValid : true;

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

  function next() {
    if (!canContinue) return;
    if (position === QUESTIONS.length - 1) finish();
    else setStep(QUESTIONS[position + 1]);
  }

  if (step === "hero") {
    return (
      <main className="onb">
        <section className="onb-frame onb-hero" aria-labelledby="onb-title">
          <div className="onb-brand"><BrandMark /><strong>RozFit</strong></div>
          <div className="onb-hero-art"><MusclePicture figure={figure} priority /></div>
          <h1 id="onb-title">Small steps.<br />Every day.</h1>
          <p className="onb-lead">A simple strength plan that fits your week, shows you each movement, and adjusts to how you feel.</p>
          <button className="button button-primary onb-cta" onClick={() => setStep("name")}>Get started <ArrowRight aria-hidden="true" /></button>
          {isDemo && hasSupabaseConfig() && (showSignIn
            ? <div className="onb-sign-in"><SignInForm /></div>
            : <button type="button" className="text-button onb-link" onClick={() => setShowSignIn(true)}>I already have an account</button>)}
        </section>
      </main>
    );
  }

  return (
    <main className="onb">
      <form className="onb-frame" aria-labelledby="onb-title" onSubmit={(event) => { event.preventDefault(); next(); }}>
        <div className="onb-top">
          <button type="button" className="onb-back" aria-label="Back" onClick={() => setStep(position === 0 ? "hero" : QUESTIONS[position - 1])}><ArrowLeft aria-hidden="true" /></button>
          <div className="onb-progress" role="progressbar" aria-label="Setup progress" aria-valuemin={1} aria-valuemax={QUESTIONS.length} aria-valuenow={position + 1}>{QUESTIONS.map((item, index) => <span key={item} className={index <= position ? "done" : ""} />)}</div>
          <span className="onb-count">{position + 1} / {QUESTIONS.length}</span>
        </div>

        {step === "name" && <>
          <h1 id="onb-title">What should we call you?</h1>
          <p className="onb-lead">Your first name is enough.</p>
          <input className="onb-input" type="text" autoComplete="given-name" autoFocus maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Your first name" aria-label="Your first name" />
        </>}

        {step === "figure" && <>
          <h1 id="onb-title">Which figure should we show?</h1>
          <p className="onb-lead">Used for the exercise pictures and muscle maps. It does not change your plan.</p>
          <div className="onb-figures" role="radiogroup" aria-label="Figure">
            {FIGURE_OPTIONS.map((option) => <button key={option.id} type="button" role="radio" aria-checked={figure === option.id} className={`onb-figure ${figure === option.id ? "selected" : ""}`} onClick={() => setFigure(option.id as FigureChoice)}>
              <MusclePicture figure={option.id} />
              <span>{option.label}</span>
            </button>)}
          </div>
        </>}

        {step === "days" && <>
          <h1 id="onb-title">Which days suit you{name.trim() ? `, ${name.trim()}` : ""}?</h1>
          <p className="onb-lead">Pick 2 to 4 days. A rest day between sessions helps you recover.</p>
          <div className="onb-days">{WEEKDAY_LABELS.map((label, day) => <button key={label} type="button" className={days.includes(day) ? "selected" : ""} aria-pressed={days.includes(day)} onClick={() => setDays((current) => current.includes(day) ? current.filter((value) => value !== day) : [...current, day].sort((a, b) => a - b))}>{label}</button>)}</div>
          <p className={`onb-hint ${daysValid ? "" : "warn"}`} role="status">{days.length} {days.length === 1 ? "day" : "days"} chosen{daysValid ? "" : " · choose between 2 and 4"}</p>
        </>}

        {step === "length" && <>
          <h1 id="onb-title">How long should a session be?</h1>
          <p className="onb-lead">Pick what you can keep up most weeks.</p>
          <div className="onb-options" role="radiogroup" aria-label="Session length">{LENGTHS.map((option) => <button key={option.minutes} type="button" role="radio" aria-checked={minutes === option.minutes} className={`onb-option ${minutes === option.minutes ? "selected" : ""}`} onClick={() => setMinutes(option.minutes)}><span><strong>{option.title}</strong><small>{option.note}</small></span><span className="onb-check">{minutes === option.minutes && <Check aria-hidden="true" />}</span></button>)}</div>
        </>}

        {step === "equipment" && <>
          <h1 id="onb-title">What can you train with?</h1>
          <p className="onb-lead">Your plan only uses equipment you tick. With none, every workout still works.</p>
          <div className="onb-options" role="radiogroup" aria-label="Equipment">
            <button type="button" role="radio" aria-checked={!knowsEquipment} className={`onb-option ${!knowsEquipment ? "selected" : ""}`} onClick={() => setKnowsEquipment(false)}><span><strong>No equipment, or not sure</strong><small>Bodyweight movements only</small></span><span className="onb-check">{!knowsEquipment && <Check aria-hidden="true" />}</span></button>
            <button type="button" role="radio" aria-checked={knowsEquipment} className={`onb-option ${knowsEquipment ? "selected" : ""}`} onClick={() => setKnowsEquipment(true)}><span><strong>I’ll tick what I have</strong><small>Gym or home equipment</small></span><span className="onb-check">{knowsEquipment && <Check aria-hidden="true" />}</span></button>
          </div>
          {knowsEquipment && <div className="onb-chips">{EQUIPMENT_OPTIONS.map((item) => <button key={item.id} type="button" className={equipment.includes(item.id) ? "selected" : ""} aria-pressed={equipment.includes(item.id)} onClick={() => setEquipment((current) => current.includes(item.id) ? current.filter((value) => value !== item.id) : [...current, item.id])}>{item.label}</button>)}</div>}
        </>}

        <button className="button button-primary onb-cta" disabled={!canContinue}>{position === QUESTIONS.length - 1 ? "Start my plan" : "Continue"} <ArrowRight aria-hidden="true" /></button>
      </form>
    </main>
  );
}
