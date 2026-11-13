"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { MAX_TRAINING_DAYS, MIN_TRAINING_DAYS, trainingDaysHint, trainingDaysValid, WEEKDAY_LABELS } from "@/lib/dates";
import { FIGURE_OPTIONS, type FigureChoice } from "@/lib/figure";
import { GOAL_OPTIONS, goalOf } from "@/lib/program";
import { LEVEL_OPTIONS, levelOf } from "@/lib/levels";
import { hasSupabaseConfig } from "@/lib/supabase-browser";
import { EQUIPMENT_OPTIONS } from "@/lib/templates";
import type { EquipmentKey, ExperienceLevel, Profile, TrainingGoal } from "@/lib/types";
import { MusclePicture } from "./muscle-picture";
import { Rozi } from "./rozi";
import { BrandMark } from "./brand-mark";
import { useFitTrack } from "./fit-track-provider";
import { SignInForm } from "./sign-in-form";

type Step = "hero" | "name" | "goal" | "level" | "figure" | "days" | "length" | "equipment" | "account";
const BASE_QUESTIONS: Step[] = ["name", "goal", "level", "figure", "days", "length", "equipment"];
const LENGTHS = [
  { minutes: 30, title: "About 30 minutes", note: "Short and focused" },
  { minutes: 40, title: "About 40 minutes", note: "A steady, unhurried session" },
  { minutes: 50, title: "About 50 minutes", note: "More time for each movement" },
];

/** First-run setup, one question per screen. Every answer can be changed later in Settings. */
export function Welcome() {
  const { state, isDemo, completeOnboarding, stageOnboarding, figure, setFigure } = useFitTrack();
  // With account sync available, the last step creates the account (or signs in) by email code.
  const QUESTIONS: Step[] = isDemo && hasSupabaseConfig() ? [...BASE_QUESTIONS, "account"] : BASE_QUESTIONS;
  const [step, setStep] = useState<Step>("hero");
  const [showSignIn, setShowSignIn] = useState(false);
  const [name, setName] = useState(isDemo ? "" : state.profile.displayName);
  const [days, setDays] = useState<number[]>(state.profile.trainingDays);
  const [goal, setGoal] = useState<TrainingGoal>(goalOf(state.profile));
  const [level, setLevel] = useState<ExperienceLevel>(levelOf(state.profile));
  const [minutes, setMinutes] = useState(state.profile.preferredSessionMinutes);
  const [knowsEquipment, setKnowsEquipment] = useState(state.profile.equipmentAvailability === "verified");
  const [equipment, setEquipment] = useState<EquipmentKey[]>(state.profile.availableEquipment);
  const position = QUESTIONS.indexOf(step);
  const daysValid = trainingDaysValid(days);
  const daysHint = trainingDaysHint(days.length);
  const canContinue = step === "name" ? Boolean(name.trim()) : step === "days" ? daysValid : true;

  function answers(): Partial<Profile> {
    return {
      displayName: name.trim() || state.profile.displayName,
      goal,
      experience: level,
      // The level starts with training (day one is set when setup finishes).
      levelSince: undefined,
      trainingDays: days,
      sessionsPerWeek: days.length,
      preferredSessionMinutes: minutes,
      equipmentAvailability: knowsEquipment ? "verified" : "unknown",
      availableEquipment: knowsEquipment ? equipment : [],
    };
  }

  function finish() {
    completeOnboarding(answers());
  }

  function next() {
    // The email step finishes by signing in, never by this button or a bubbled form submit.
    if (!canContinue || step === "account") return;
    if (position === QUESTIONS.length - 1) finish();
    else setStep(QUESTIONS[position + 1]);
  }

  const Frame = step === "account" ? "section" : "form";

  if (step === "hero") {
    return (
      <main className="onb">
        <section className="onb-frame onb-hero" aria-labelledby="onb-title">
          <div className="onb-brand"><BrandMark /><strong>RozFit</strong></div>
          <div className="onb-hero-art">
            <div className="onb-rozi">
              <span className="onb-rozi-hello" aria-hidden="true">Hi, I’m Rozi!</span>
              <Rozi mood="hello" size={240} priority className="onb-rozi-img" />
            </div>
          </div>
          <h1 id="onb-title">Small steps.<br />Every day.</h1>
          <p className="onb-lead">I’m your workout buddy. A simple strength plan that fits your week, shows you each movement, and adjusts to how you feel.</p>
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
      {/* The email step has its own form, and forms cannot sit inside each other. */}
      <Frame className="onb-frame" aria-labelledby="onb-title" onSubmit={step === "account" ? undefined : (event: React.FormEvent) => { event.preventDefault(); next(); }}>
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

        {step === "level" && <>
          <h1 id="onb-title">How much have you trained?</h1>
          <p className="onb-lead">Your first workouts start at this level. As you keep showing up, RozFit moves you up by itself.</p>
          <div className="onb-options" role="radiogroup" aria-label="Fitness level">{LEVEL_OPTIONS.map((option) => <button key={option.id} type="button" role="radio" aria-checked={level === option.id} className={`onb-option ${level === option.id ? "selected" : ""}`} onClick={() => setLevel(option.id)}><span><strong>{option.title}</strong><small>{option.note}</small></span><span className="onb-check">{level === option.id && <Check aria-hidden="true" />}</span></button>)}</div>
        </>}

        {step === "goal" && <>
          <h1 id="onb-title">What’s your main goal?</h1>
          <p className="onb-lead">Your plan, weekly split and progress steps follow this. You can change it later in Settings.</p>
          <div className="onb-options" role="radiogroup" aria-label="Goal">{GOAL_OPTIONS.map((option) => <button key={option.id} type="button" role="radio" aria-checked={goal === option.id} className={`onb-option ${goal === option.id ? "selected" : ""}`} onClick={() => { setGoal(option.id); setDays(option.days); }}><span><strong>{option.title}</strong><small>{option.note}</small></span><span className="onb-check">{goal === option.id && <Check aria-hidden="true" />}</span></button>)}</div>
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
          <p className="onb-lead">Pick {MIN_TRAINING_DAYS} to {MAX_TRAINING_DAYS} days. Rest days help your muscles recover.</p>
          <div className="onb-days">{WEEKDAY_LABELS.map((label, day) => <button key={label} type="button" className={days.includes(day) ? "selected" : ""} aria-pressed={days.includes(day)} onClick={() => setDays((current) => current.includes(day) ? current.filter((value) => value !== day) : [...current, day].sort((a, b) => a - b))}>{label}</button>)}</div>
          <p className={`onb-hint ${daysValid ? "" : "warn"}`} role="status">{days.length} {days.length === 1 ? "day" : "days"} chosen{daysHint ? ` · ${daysHint}` : ""}</p>
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

        {step === "account" && <>
          <Rozi mood="signin" size={120} className="onb-account-rozi" />
          <h1 id="onb-title">Save your plan{name.trim() ? `, ${name.trim()}` : ""}</h1>
          <p className="onb-lead">Enter your email and we’ll send a 6-digit code. No password. Your plan, streak and progress stay safe on any phone, and you can add friends.</p>
          <div className="onb-sign-in"><SignInForm beforeVerify={() => stageOnboarding(answers())} /></div>
        </>}

        {step !== "account" && <button className="button button-primary onb-cta" disabled={!canContinue}>{position === QUESTIONS.length - 1 ? "Start my plan" : "Continue"} <ArrowRight aria-hidden="true" /></button>}
      </Frame>
    </main>
  );
}
