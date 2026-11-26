"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  ArrowLeft, ArrowRight, Building2, CalendarCheck, Check, Circle, CircleCheck, LoaderCircle, House, PersonStanding, Search, Sparkles, Target, TrendingUp, Warehouse, Zap, type LucideIcon,
} from "lucide-react";
import { MAX_TRAINING_DAYS, MIN_TRAINING_DAYS, shiftDate, trainingDaysHint, trainingDaysValid, WEEKDAY_LABELS } from "@/lib/dates";
import { FIGURE_OPTIONS, type FigureChoice } from "@/lib/figure";
import { GOAL_OPTIONS, goalOf, goalTitle } from "@/lib/program";
import { LEVEL_OPTIONS, levelOf, levelTitle } from "@/lib/levels";
import { bodyPlan, MIN_AGE, validBodyStats } from "@/lib/body";
import { ACTIVITY_OPTIONS, DID_YOU_KNOW, equipmentPicture, FOCUS_OPTIONS, GYM_OPTIONS, gymPicture, gymPreset, type DailyActivity, type FocusArea, type GymType } from "@/lib/onboarding";
import { haptic } from "@/lib/haptics";
import { BmiCard, draftStats, draftWhy, EMPTY_BODY_DRAFT, WhyFields, whyDraftValid, type BodyDraft } from "./body-form";
import { hasSupabaseConfig } from "@/lib/supabase-browser";
import { EQUIPMENT_OPTIONS } from "@/lib/templates";
import { todayInTimeZone } from "@/lib/demo-data";
import type { EquipmentKey, ExperienceLevel, Profile, TrainingGoal } from "@/lib/types";
import { MusclePicture } from "./muscle-picture";
import { Rozi } from "./rozi";
import { BrandMark } from "./brand-mark";
import { useFitTrack } from "./fit-track-provider";
import { SignInForm } from "./sign-in-form";
import { WheelPicker } from "@/components/ui/wheel-picker";
import { RulerPicker } from "@/components/ui/ruler-picker";

type Step = "hero" | "slides" | "name" | "height" | "weight" | "activity" | "birth" | "stats" | "why" | "fact" | "level" | "goal" | "focus" | "figure"
  | "days" | "length" | "gym" | "equipment" | "firstday" | "reminders" | "building" | "program" | "account";
const BASE_QUESTIONS: Step[] = ["name", "height", "weight", "activity", "birth", "stats", "why", "fact", "level", "goal", "focus", "figure", "days", "length", "gym", "equipment", "firstday", "reminders", "building", "program"];
/** Steps that can be skipped with the top-right "Skip". */
const SKIPPABLE = new Set<Step>(["activity", "fact", "focus", "figure", "gym", "equipment", "firstday", "reminders"]);
const LENGTHS = [
  { minutes: 30, title: "About 30 minutes", note: "Short and focused" },
  { minutes: 40, title: "About 40 minutes", note: "A steady, unhurried session", recommended: true },
  { minutes: 50, title: "About 50 minutes", note: "More time for each movement" },
];
const GYM_ICONS: Record<GymType, LucideIcon> = { large_gym: Building2, small_gym: Warehouse, home: House, bodyweight: PersonStanding };
/** The plan-building steps, ticked off one by one; each matches real work the planner does with your answers. */
const BUILD_STEPS = ["Reading your body stats", "Checking your goal and level", "Picking moves for your equipment", "Balancing muscles across your week", "Setting sets, reps and rest", "Adding rest and recovery days", "Your plan is ready"];
/** Row height of the plan-building list (CSS .build-steps rows match it). */
const BUILD_ROW = 46;
/** Flags the app shell acts on after setup: open Train today, and turn on reminders once signed in. */
export const START_TODAY_KEY = "rozfit-start-today";
export const WANT_PUSH_KEY = "rozfit-want-push";

const THIS_YEAR = new Date().getFullYear();
const BIRTH_YEARS = Array.from({ length: 78 }, (_, i) => THIS_YEAR - MIN_AGE - i);
const HEIGHTS_CM = Array.from({ length: 111 }, (_, i) => 120 + i);
const HEIGHTS_IN = Array.from({ length: 43 }, (_, i) => 48 + i);

/** First-run setup, one question per screen (like the reference apps). Every answer can be changed later in Settings. */
export function Welcome() {
  const { state, isDemo, completeOnboarding, stageOnboarding, figure, setFigure, setWeightUnit } = useFitTrack();
  // With account sync available, the last step creates the account (or signs in) by email code.
  const QUESTIONS: Step[] = isDemo && hasSupabaseConfig() ? [...BASE_QUESTIONS, "account"] : BASE_QUESTIONS;
  const [step, setStep] = useState<Step>("hero");
  const [slide, setSlide] = useState(0);
  const [showSignIn, setShowSignIn] = useState(false);
  const [name, setName] = useState(isDemo ? "" : state.profile.displayName);
  const [days, setDays] = useState<number[]>(state.profile.trainingDays);
  const [goal, setGoal] = useState<TrainingGoal>(goalOf(state.profile));
  const [level, setLevel] = useState<ExperienceLevel>(levelOf(state.profile));
  const [body, setBody] = useState<BodyDraft>({ ...EMPTY_BODY_DRAFT, heightCm: "170", feet: "5", inches: "7", weight: "70", age: String(THIS_YEAR - 1995) });
  const [goalTouched, setGoalTouched] = useState(false);
  const [focus, setFocus] = useState<FocusArea>(state.profile.focusArea ?? "balanced");
  const [activity, setActivity] = useState<DailyActivity | null>(state.profile.dailyActivity ?? null);
  const [gym, setGym] = useState<GymType | null>(state.profile.gymType ?? null);
  const [minutes, setMinutes] = useState(state.profile.preferredSessionMinutes);
  const [knowsEquipment, setKnowsEquipment] = useState(state.profile.equipmentAvailability === "verified");
  const [equipment, setEquipment] = useState<EquipmentKey[]>(state.profile.availableEquipment);
  const [equipmentQuery, setEquipmentQuery] = useState("");
  const [firstDay, setFirstDay] = useState<"today" | "tomorrow" | "unsure">("today");
  const [built, setBuilt] = useState(0);
  const bodyStats = draftStats(body);
  const plan = validBodyStats(bodyStats) ? bodyPlan(bodyStats) : null;
  const position = QUESTIONS.indexOf(step);
  const daysValid = trainingDaysValid(days);
  const daysHint = trainingDaysHint(days.length);
  const metric = body.unit === "metric";
  const canContinue = step === "name" ? Boolean(name.trim()) : step === "stats" ? Boolean(plan) : step === "why" ? whyDraftValid(body) : step === "days" ? daysValid : step === "activity" ? Boolean(activity) : step === "gym" ? Boolean(gym) : step === "building" ? built >= 100 : true;

  // "Building your plan": a short progress animation, then on to the summary.
  useEffect(() => {
    if (step !== "building") return;
    const started = Date.now();
    const timer = window.setInterval(() => {
      const pct = Math.min(100, Math.round(((Date.now() - started) / 4400) * 100));
      setBuilt(pct);
      if (pct >= 100) window.clearInterval(timer);
    }, 60);
    return () => window.clearInterval(timer);
  }, [step]);
  useEffect(() => {
    if (step !== "building" || built < 100) return;
    const timer = window.setTimeout(() => setStep("program"), 450);
    return () => window.clearTimeout(timer);
  }, [step, built]);

  function answers(): Partial<Profile> {
    const today = todayInTimeZone(state.profile.timeZone);
    return {
      displayName: name.trim() || state.profile.displayName,
      goal,
      experience: level,
      heightCm: bodyStats.heightCm,
      birthYear: bodyStats.age ? THIS_YEAR - bodyStats.age : undefined,
      sex: bodyStats.sex,
      why: draftWhy(body),
      focusArea: focus,
      ...(activity ? { dailyActivity: activity } : {}),
      ...(gym ? { gymType: gym } : {}),
      // The level starts with training (day one is set when setup finishes).
      levelSince: undefined,
      trainingDays: days,
      sessionsPerWeek: days.length,
      preferredSessionMinutes: minutes,
      equipmentAvailability: knowsEquipment ? "verified" : "unknown",
      availableEquipment: knowsEquipment ? equipment : [],
      // "Tomorrow" starts the plan tomorrow, so today is never counted as missed.
      ...(firstDay === "tomorrow" ? { trainingStartDate: shiftDate(today, 1) } : {}),
    };
  }

  function rememberFirstDay() {
    try {
      if (firstDay === "today") window.localStorage.setItem(START_TODAY_KEY, "1");
      else window.localStorage.removeItem(START_TODAY_KEY);
    } catch { /* private mode: Home still has the workout */ }
  }

  function finish() {
    rememberFirstDay();
    completeOnboarding(answers(), bodyStats.weightKg);
  }

  /** One unit for height and weight: switching on either screen converts the weight too (it was left as the same
   *  number, so 70 kg became "70 lb"). */
  function switchUnit(unit: "metric" | "us") {
    setBody((current) => current.unit === unit ? current : {
      ...current, unit,
      weight: unit === "metric" ? String(Math.round(Number(current.weight) * 0.45359237 * 2) / 2 || 70) : String(Math.round(Number(current.weight) / 0.45359237) || 154),
    });
  }
  function go(next: Step) { setStep(next); window.scrollTo({ top: 0 }); }

  function next() {
    // The email step finishes by signing in, never by this button or a bubbled form submit.
    if (!canContinue || step === "account") return;
    if (step === "stats") {
      // Imperial users see weights in pounds from now on.
      if (body.unit === "us") setWeightUnit("lb");
      // The BMI result picks the suggested goal (until the person picks one themselves).
      if (plan && !goalTouched) { setGoal(plan.recommendedGoal); setDays(GOAL_OPTIONS.find((option) => option.id === plan.recommendedGoal)?.days ?? days); }
    }
    if (step === "building") setBuilt(0);
    if (position === QUESTIONS.length - 1) finish();
    else go(QUESTIONS[position + 1]);
  }

  function skip() {
    if (step === "gym" && !gym) { setGym("bodyweight"); setKnowsEquipment(false); setEquipment([]); }
    go(QUESTIONS[position + 1]);
  }

  async function allowReminders() {
    try {
      if ("Notification" in window && Notification.permission === "default") await Notification.requestPermission();
      window.localStorage.setItem(WANT_PUSH_KEY, "1");
    } catch { /* not supported here; reminders can be turned on in Settings */ }
    next();
  }

  const shownEquipment = useMemo(() => {
    const words = equipmentQuery.trim().toLowerCase();
    return EQUIPMENT_OPTIONS.filter((item) => !words || item.label.toLowerCase().includes(words));
  }, [equipmentQuery]);

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
          <button className="button button-primary onb-cta" onClick={() => go("slides")}>Get started <ArrowRight aria-hidden="true" /></button>
          {isDemo && hasSupabaseConfig() && (showSignIn
            ? <div className="onb-sign-in"><SignInForm /></div>
            : <button type="button" className="text-button onb-link" onClick={() => setShowSignIn(true)}>I already have an account</button>)}
        </section>
      </main>
    );
  }

  if (step === "slides") {
    const slides = [
      { title: "Log every set", text: "Tick sets as you go. Rozi times your rest and remembers your weights." },
      { title: "See your progress", text: "Charts, records and a streak calendar show what’s working." },
      { title: "Train with friends", text: "Add friends and trainers, send nudges and take on challenges." },
    ];
    const current = slides[slide];
    return (
      <main className="onb">
        <section className="onb-frame slides" aria-labelledby="onb-title">
          <div className="onb-top"><button type="button" className="onb-back" aria-label="Back" onClick={() => slide ? setSlide(slide - 1) : go("hero")}><ArrowLeft aria-hidden="true" /></button><button type="button" className="onb-skip" onClick={() => go("name")}>Skip</button></div>
          <h1 id="onb-title">{current.title}</h1>
          <p className="onb-lead">{current.text}</p>
          <span className="slide-art" aria-hidden="true"><Image key={slide} src={`/rozi/slides/v1/${["slide-log", "slide-progress", "slide-friends"][slide]}.webp`} alt="" width={900} height={600} sizes="(max-width: 700px) 90vw, 440px" priority /></span>
          <div className="fact-dots" aria-hidden="true">{slides.map((_, i) => <span key={i} className={i === slide ? "on" : ""} />)}</div>
          <button className="button button-primary onb-cta" onClick={() => slide < slides.length - 1 ? setSlide(slide + 1) : go("name")}>Continue <ArrowRight aria-hidden="true" /></button>
        </section>
      </main>
    );
  }

  if (step === "building") {
    const current = Math.min(BUILD_STEPS.length - 1, Math.floor(built / (100 / (BUILD_STEPS.length - 1))));
    const extra = focus !== "balanced" ? ` · extra ${FOCUS_OPTIONS.find((option) => option.id === focus)?.label.toLowerCase()}` : "";
    return (
      <main className="onb">
        <section className="onb-frame building" aria-live="polite">
          <Rozi mood={built >= 100 ? "cheer" : "workout"} size={150} eager />
          <h1>A plan built around you{name.trim() ? `, ${name.trim()}` : ""}</h1>
          <div className="building-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={built}><i style={{ width: `${built}%` }} /></div>
          <span className="building-percent">{built}%</span>
          {/* Plan steps (2026-11-26, after Aceternity's Multi Step Loader): the list scrolls up so the current step stays
              on the middle line; done steps tick, and steps fade the further they are from the current one. */}
          <div className="build-steps" role="list" aria-label="Building your plan">
            <div className="build-steps-track" style={{ transform: `translateY(${-current * BUILD_ROW}px)` }}>
              {BUILD_STEPS.map((text, index) => {
                const state = index < current || built >= 100 ? "done" : index === current ? "current" : "todo";
                return (
                  <div key={text} role="listitem" className={state} aria-current={state === "current" ? "step" : undefined}
                    style={{ opacity: Math.max(1 - Math.abs(index - current) * 0.3, 0.1) }}>
                    {state === "done" ? <CircleCheck aria-hidden="true" /> : state === "current" ? <LoaderCircle className="spin" aria-hidden="true" /> : <Circle aria-hidden="true" />}
                    <span>{text}{index === 2 ? extra : ""}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>
    );
  }

  const optionalStep = SKIPPABLE.has(step);
  return (
    <main className="onb">
      {/* The email step has its own form, and forms cannot sit inside each other. */}
      <Frame className="onb-frame" aria-labelledby="onb-title" onSubmit={step === "account" ? undefined : (event: React.FormEvent) => { event.preventDefault(); next(); }}>
        <div className="onb-top">
          <button type="button" className="onb-back" aria-label="Back" onClick={() => go(position === 0 ? "slides" : QUESTIONS[position - 1] === "building" ? "reminders" : QUESTIONS[position - 1])}><ArrowLeft aria-hidden="true" /></button>
          <div className="onb-progress bar" role="progressbar" aria-label="Setup progress" aria-valuemin={1} aria-valuemax={QUESTIONS.length} aria-valuenow={position + 1}><i style={{ width: `${((position + 1) / QUESTIONS.length) * 100}%` }} /></div>
          {optionalStep ? <button type="button" className="onb-skip" onClick={skip}>Skip</button> : <span className="onb-count">{position + 1}/{QUESTIONS.length}</span>}
        </div>

        {step === "name" && <>
          <h1 id="onb-title">What should we call you?</h1>
          <p className="onb-lead">Your first name is enough.</p>
          <input className="onb-input" type="text" autoComplete="given-name" autoFocus maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Your first name" aria-label="Your first name" />
        </>}

        {step === "height" && <>
          <h1 id="onb-title">What’s your height?</h1>
          <div className="segmented onb-unit-toggle" role="radiogroup" aria-label="Height unit">
            <button type="button" role="radio" aria-checked={metric} className={metric ? "selected" : ""} onClick={() => switchUnit("metric")}>Centimetres</button>
            <button type="button" role="radio" aria-checked={!metric} className={!metric ? "selected" : ""} onClick={() => switchUnit("us")}>Feet and inches</button>
          </div>
          {metric
            ? <WheelPicker key="cm" label="Height in centimetres" items={HEIGHTS_CM} value={Number(body.heightCm) || 170} format={(cm) => `${cm} cm`} onChange={(cm) => setBody((current) => ({ ...current, heightCm: String(cm) }))} />
            : <WheelPicker key="in" label="Height in feet and inches" items={HEIGHTS_IN} value={(Number(body.feet) || 5) * 12 + (Number(body.inches) || 0)} format={(inches) => `${Math.floor(inches / 12)}′ ${inches % 12}″`} onChange={(inches) => setBody((current) => ({ ...current, feet: String(Math.floor(inches / 12)), inches: String(inches % 12) }))} />}
          <p className="onb-hint">Your data is private and only used for your plan.</p>
        </>}

        {step === "weight" && <>
          <h1 id="onb-title">What’s your weight?</h1>
          <div className="segmented onb-unit-toggle" role="radiogroup" aria-label="Weight unit">
            <button type="button" role="radio" aria-checked={metric} className={metric ? "selected" : ""} onClick={() => switchUnit("metric")}>Kilograms</button>
            <button type="button" role="radio" aria-checked={!metric} className={!metric ? "selected" : ""} onClick={() => switchUnit("us")}>Pounds</button>
          </div>
          {metric
            ? <RulerPicker key="kg" label="Weight in kilograms" min={30} max={200} step={0.5} major={5} unit="kg" value={Number(body.weight) || 70} onChange={(kg) => setBody((current) => ({ ...current, weight: String(kg) }))} />
            : <RulerPicker key="lb" label="Weight in pounds" min={66} max={440} step={1} major={10} unit="lb" value={Number(body.weight) || 154} onChange={(lb) => setBody((current) => ({ ...current, weight: String(lb) }))} />}
        </>}

        {step === "activity" && <>
          <h1 id="onb-title">How active is your typical day?</h1>
          <p className="onb-lead">Outside your workouts. It tunes your water target and stretch suggestions.</p>
          <div className="onb-options" role="radiogroup" aria-label="Typical day">{ACTIVITY_OPTIONS.map((option) => <button key={option.id} type="button" role="radio" aria-checked={activity === option.id} className={`onb-option ${activity === option.id ? "selected" : ""}`} onClick={() => { haptic(); setActivity(option.id); }}><span><strong>{option.label}</strong><small>{option.note}</small></span><span className="onb-check">{activity === option.id && <Check aria-hidden="true" />}</span></button>)}</div>
        </>}

        {step === "birth" && <>
          <h1 id="onb-title">When were you born?</h1>
          <p className="onb-lead">Age helps set safe targets. RozFit is for ages {MIN_AGE} and up.</p>
          <WheelPicker label="Year of birth" items={BIRTH_YEARS} value={THIS_YEAR - (Number(body.age) || 30)} onChange={(year) => setBody((current) => ({ ...current, age: String(THIS_YEAR - year) }))} />
          <div className="body-sex">
            <span>For realistic muscle targets (optional)</span>
            <div className="segmented" role="radiogroup" aria-label="Sex">
              {(["female", "male", "other"] as const).map((value) => <button key={value} type="button" role="radio" aria-checked={body.sex === value} className={body.sex === value ? "selected" : ""} onClick={() => setBody((current) => ({ ...current, sex: current.sex === value ? "" : value }))}>{value === "other" ? "Prefer not to say" : value[0].toUpperCase() + value.slice(1)}</button>)}
            </div>
          </div>
        </>}

        {step === "stats" && <>
          <h1 id="onb-title">Done! Check your details</h1>
          <div className="stats-grid">
            <div><strong>{bodyStats.age ?? "—"}</strong><small>Age</small></div>
            <div><strong>{body.sex ? (body.sex === "other" ? "—" : body.sex[0].toUpperCase() + body.sex.slice(1)) : "—"}</strong><small>Sex</small></div>
            <div><strong>{metric ? `${body.heightCm} cm` : `${body.feet}′ ${body.inches}″`}</strong><small>Height</small></div>
            <div><strong>{body.weight} {metric ? "kg" : "lb"}</strong><small>Weight</small></div>
          </div>
          {plan ? <>
            <div className="bmi-toast" role="status"><Zap aria-hidden="true" /><span>Your BMI is <strong>{plan.bmi}</strong>. {plan.band === "healthy" ? "Nice! Let’s get you even stronger." : "Rozi has a plan for that."}</span></div>
            <BmiCard plan={plan} />
          </> : <p className="body-warn">These numbers don’t look right. Go back and check them.</p>}
        </>}

        {step === "why" && <>
          <h1 id="onb-title">Why are you starting?</h1>
          <p className="onb-lead">Pick up to 3. On tough days, Rozi will remind you why you began.</p>
          <WhyFields draft={body} onChange={setBody} />
        </>}

        {step === "fact" && <>
          <article className="panel fact-card">
            <Rozi mood="hello" size={120} />
            <span className="onb-kicker"><Sparkles aria-hidden="true" /> Did you know?</span>
            <h2 id="onb-title">{DID_YOU_KNOW[0].title}</h2>
            <p>{DID_YOU_KNOW[0].text}</p>
            <p><strong>You’re in the right place{name.trim() ? `, ${name.trim()}` : ""}.</strong></p>
          </article>
        </>}

        {step === "level" && <>
          <h1 id="onb-title">How much have you trained?</h1>
          <p className="onb-lead">Your first workouts start at this level. As you keep showing up, RozFit moves you up by itself.</p>
          {plan && (plan.band === "obese" || plan.youth) && <p className="onb-hint">Rozi suggests <strong>Beginner</strong> to start — it’s kindest on your joints, and you’ll move up as you go.</p>}
          <div className="onb-options" role="radiogroup" aria-label="Fitness level">{LEVEL_OPTIONS.map((option) => <button key={option.id} type="button" role="radio" aria-checked={level === option.id} className={`onb-option ${level === option.id ? "selected" : ""}`} onClick={() => setLevel(option.id)}><span><strong>{option.title}</strong><small>{option.note}</small></span><span className="onb-check">{level === option.id && <Check aria-hidden="true" />}</span></button>)}</div>
        </>}

        {step === "goal" && <>
          <h1 id="onb-title">What’s your main goal?</h1>
          <p className="onb-lead">Your plan, weekly split and progress steps follow this. You can change it later in Settings.</p>
          <div className="onb-options" role="radiogroup" aria-label="Goal">{GOAL_OPTIONS.map((option) => <button key={option.id} type="button" role="radio" aria-checked={goal === option.id} className={`onb-option ${goal === option.id ? "selected" : ""}`} onClick={() => { setGoal(option.id); setDays(option.days); setGoalTouched(true); }}><span><strong>{option.title}{plan?.recommendedGoal === option.id && <em className="onb-recommended">Suggested for you</em>}</strong><small>{option.note}</small></span><span className="onb-check">{goal === option.id && <Check aria-hidden="true" />}</span></button>)}</div>
        </>}

        {step === "focus" && <>
          <h1 id="onb-title">Any muscle to focus on?</h1>
          <p className="onb-lead">Your plan stays well-rounded; a focus muscle gets one extra set when it’s trained.</p>
          <div className="onb-options" role="radiogroup" aria-label="Focus muscle">{FOCUS_OPTIONS.map((option) => <button key={option.id} type="button" role="radio" aria-checked={focus === option.id} className={`onb-option with-thumb ${focus === option.id ? "selected" : ""}`} onClick={() => setFocus(option.id)}>
            <span className="onb-thumb"><MusclePicture figure={figure} region={option.regions[0]} highlight={option.regions} /></span>
            <span><strong>{option.label}{option.id === "balanced" && <em className="onb-recommended">Recommended</em>}</strong><small>{option.note}</small></span>
            <span className="onb-check">{focus === option.id && <Check aria-hidden="true" />}</span>
          </button>)}</div>
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
          <div className="onb-options" role="radiogroup" aria-label="Session length">{LENGTHS.map((option) => <button key={option.minutes} type="button" role="radio" aria-checked={minutes === option.minutes} className={`onb-option ${minutes === option.minutes ? "selected" : ""}`} onClick={() => setMinutes(option.minutes)}><span><strong>{option.title}{option.recommended && <em className="onb-recommended">Recommended</em>}</strong><small>{option.note}</small></span><span className="onb-check">{minutes === option.minutes && <Check aria-hidden="true" />}</span></button>)}</div>
        </>}

        {step === "gym" && <>
          <h1 id="onb-title">Where do you work out?</h1>
          <p className="onb-lead">This sets your starting equipment. You can fine-tune it next.</p>
          <div className="gym-cards" role="radiogroup" aria-label="Where you train">{GYM_OPTIONS.map((option) => (
            <button key={option.id} type="button" role="radio" aria-checked={gym === option.id} className={`gym-card ${gym === option.id ? "selected" : ""}`} onClick={() => { setGym(option.id); setEquipment(gymPreset(option.id)); setKnowsEquipment(option.id !== "bodyweight"); }}>
              <span className="gym-card-photo"><Image src={gymPicture(option.id)} alt="" width={960} height={600} sizes="(max-width: 700px) 46vw, 260px" loading="eager" /></span>
              <span className="gym-card-text"><strong>{option.label}</strong><small>{option.note}</small></span>
              <span className="onb-check">{gym === option.id && <Check aria-hidden="true" />}</span>
            </button>
          ))}</div>
        </>}

        {step === "equipment" && <>
          <h1 id="onb-title">Check your equipment</h1>
          <p className="onb-lead">Your plan only uses what’s switched on. You can change it any time in Settings.</p>
          <label className="settings-search equip-search"><Search aria-hidden="true" /><input type="search" value={equipmentQuery} onChange={(event) => setEquipmentQuery(event.target.value)} placeholder="Search equipment" aria-label="Search equipment" /></label>
          <div className="equip-list">{shownEquipment.map((item) => {
            const on = knowsEquipment && equipment.includes(item.id);
            return <button key={item.id} type="button" role="switch" aria-checked={on} className="equip-row" onClick={() => {
              setKnowsEquipment(true);
              setEquipment((current) => current.includes(item.id) ? current.filter((value) => value !== item.id) : [...current, item.id]);
            }}><span className="equip-pic"><Image src={equipmentPicture(item.id)} unoptimized={equipmentPicture(item.id).endsWith(".svg")} alt="" width={96} height={96} sizes="56px" loading="eager" /></span><span>{item.label}</span><span className={`switch ${on ? "on" : ""}`} aria-hidden="true" /></button>;
          })}</div>
          <p className="onb-hint">{knowsEquipment && equipment.length ? `${equipment.length} switched on` : "Nothing on: every workout uses bodyweight moves."}</p>
        </>}

        {step === "firstday" && <>
          <h1 id="onb-title">Great! When’s your first workout?</h1>
          <p className="onb-lead">People who start within a few days are much more likely to keep going. No pressure, though.</p>
          <div className="onb-options" role="radiogroup" aria-label="First workout">{([["today", "Today", "Let’s go — Train opens right away"], ["tomorrow", "Tomorrow", "Your plan starts tomorrow"], ["unsure", "Not sure yet", "Start whenever you’re ready"]] as const).map(([id, title, note]) => <button key={id} type="button" role="radio" aria-checked={firstDay === id} className={`onb-option ${firstDay === id ? "selected" : ""}`} onClick={() => setFirstDay(id)}><span><strong>{title}</strong><small>{note}</small></span><span className="onb-check">{firstDay === id && <Check aria-hidden="true" />}</span></button>)}</div>
          {firstDay === "today" && <p className="bmi-toast"><Zap aria-hidden="true" /><span>You mean business, and Rozi loves it!</span></p>}
        </>}

        {step === "reminders" && <>
          <h1 id="onb-title">Never miss a workout</h1>
          <p className="onb-lead">Rozi sends a short reminder on training days, a water nudge and a gentle comeback note. You choose which ones in Settings.</p>
          <div className="push-preview" aria-hidden="true">
            <div className="push-preview-head"><img src="/icons/icon-192.png" alt="" /> ROZFIT <time>now</time></div>
            <strong>Good morning{name.trim() ? `, ${name.trim()}` : ""}! 💪</strong>
            <p>Today’s workout is ready: about {minutes} minutes. Rozi’s waiting.</p>
          </div>
          <button type="button" className="button button-primary onb-cta" onClick={() => void allowReminders()}>Allow notifications</button>
        </>}

        {step === "program" && <>
          <span className="program-art"><Image src="/gyms/v1/program.webp" alt="" width={960} height={640} sizes="(max-width: 700px) 92vw, 460px" priority /></span>
          <span className="onb-kicker">Recommended program</span>
          <h1 id="onb-title">Your personalised program</h1>
          <p className="onb-lead">{goalTitle(goal)}, built for {days.length} days a week at the {levelTitle(level).toLowerCase()} level.</p>
          <div className="program-grid">
            <div className="program-tile"><small>Goal</small><strong>{goalTitle(goal)}</strong><Target aria-hidden="true" /></div>
            <div className="program-tile"><small>Equipment</small><strong>{GYM_OPTIONS.find((option) => option.id === gym)?.label ?? (knowsEquipment ? `${equipment.length} items` : "Bodyweight")}</strong>{(() => { const Icon = gym ? GYM_ICONS[gym] : PersonStanding; return <Icon aria-hidden="true" />; })()}</div>
            <div className="program-tile"><small>Level</small><strong>{levelTitle(level)}</strong><div className="program-bars">{LEVEL_OPTIONS.map((option, i) => <span key={option.id} className={i <= LEVEL_OPTIONS.findIndex((item) => item.id === level) ? "on" : ""} />)}</div></div>
            <div className="program-tile"><small>Workouts / week</small><strong>{days.length}</strong><div className="program-bars">{WEEKDAY_LABELS.map((label, i) => <span key={label} className={i < days.length ? "on" : ""} />)}</div></div>
            <div className="program-tile"><small>Focus</small><strong>{FOCUS_OPTIONS.find((option) => option.id === focus)?.label}</strong></div>
            <div className="program-tile"><small>Session</small><strong>About {minutes} min</strong></div>
          </div>
          <h3 className="train-subhead">Training strategy</h3>
          <div className="panel program-strategy">
            <div><TrendingUp aria-hidden="true" /><span><strong>Progressive overload</strong><small>Reps go up first, then a small weight step, so you keep getting stronger safely.</small></span></div>
            <div><CalendarCheck aria-hidden="true" /><span><strong>Rest built in</strong><small>Rest days and recovery weeks are planned; missed days never pile up.</small></span></div>
            <div><Sparkles aria-hidden="true" /><span><strong>Progress you can see</strong><small>Charts, records, streaks and a weekly note from Rozi.</small></span></div>
          </div>
        </>}

        {step === "account" && <>
          <Rozi mood="signin" size={120} className="onb-account-rozi" />
          <h1 id="onb-title">Save your plan{name.trim() ? `, ${name.trim()}` : ""}</h1>
          <p className="onb-lead">Enter your email and we’ll send a 6-digit code. No password. Your plan, streak and progress stay safe on any phone, and you can add friends.</p>
          <div className="onb-sign-in"><SignInForm beforeVerify={() => { rememberFirstDay(); stageOnboarding(answers(), bodyStats.weightKg); }} /></div>
        </>}

        {step !== "account" && step !== "reminders" && <button className="button button-primary onb-cta" disabled={!canContinue}>{step === "program" ? (QUESTIONS.includes("account") ? "Save my program" : "Start my plan") : position === QUESTIONS.length - 1 ? "Start my plan" : "Continue"} <ArrowRight aria-hidden="true" /></button>}
        {step === "reminders" && <button type="button" className="text-button onb-link" onClick={next}>Not now</button>}
      </Frame>
    </main>
  );
}
